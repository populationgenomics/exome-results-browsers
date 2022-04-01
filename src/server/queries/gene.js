/* eslint-disable no-unused-vars */

const { mean } = require('lodash')
const { quantileSeq } = require('mathjs')

const { config: serverConfig } = require('../config')

const { tableIds, defaultQueryOptions, submitQuery, sampleNormal } = require('./utilities')
const { fetchCellTypes } = require('./cellType')

const GENE_SYMBOL_COLUMN = serverConfig.enableNewDatabase ? 'gene_symbol' : 'symbol'
const ASSOCIATION_GENE_ID_COLUMN = serverConfig.enableNewDatabase ? 'gene_id' : 'ensembl_gene_id'

/**
 * @param {string} query
 * @param {{config?: object}} options
 *
 * @returns {Promise<{id: string, symbol: string}|null>}
 */
const resolveGene = async (query, { config = {} } = {}) => {
  if (!query) throw new Error("Parameter 'query' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}`
  const selectStatement = `SELECT DISTINCT gene_id id, ${GENE_SYMBOL_COLUMN} symbol FROM ${table}`
  const filters = ['UPPER(gene_id) = UPPER(@query)', `UPPER(${GENE_SYMBOL_COLUMN}) = UPPER(@query)`]
  const sqlQuery = [selectStatement, filters.length ? `WHERE ${filters.join(' OR ')}` : null]
    .filter((c) => !!c)
    .join('\n')

  const [gene] = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: { query: query.toString().toUpperCase() } },
  })

  return gene
}

/**
 * @param {string[]} queries
 * @param {{config?: object}} options
 *
 * @returns {Promise<{id: string, symbol: string}[]>}
 */
const resolveGenes = async (queries, { config = {} } = {}) => {
  if (!queries) throw new Error("Parameter 'query' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}`
  const selectStatement = `SELECT DISTINCT gene_id id, ${GENE_SYMBOL_COLUMN} symbol FROM ${table}`
  const filters = [
    'UPPER(gene_id) IN UNNEST(@queries)',
    `UPPER(${GENE_SYMBOL_COLUMN}) IN UNNEST(@queries)`,
  ]
  const sqlQuery = [selectStatement, filters.length ? `WHERE ${filters.join(' OR ')}` : null]
    .filter((c) => !!c)
    .join('\n')

  const genes = await submitQuery({
    query: sqlQuery,
    options: {
      ...queryOptions,
      params: { queries: queries.map((s) => s.toString().toUpperCase()) },
    },
  })

  return genes
}

/**
 * @param {{query?: string, expand?: boolean, limit?: number, config?: object}} options
 *
 * @returns {Promise<object[]>}
 */
const fetchGenes = async ({ query = null, expand = false, limit = 25, config = {} } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}`
  const columns = expand ? '*' : 'DISTINCT gene_id, symbol'
  const selectStatement = `SELECT ${columns} FROM ${table}`

  const queryParams = {}
  const filters = []
  if (query) {
    queryParams.query = query
    filters.push(
      ...[
        'UPPER(gene_id) = UPPER(@query)',
        'UPPER(canonical_transcript_id) = UPPER(@query)',
        `UPPER(symbol) = @query`,
        `REGEXP_CONTAINS(UPPER(symbol), CONCAT('^', @query))`,
        "REGEXP_CONTAINS(UPPER(gene_id), CONCAT('^', @query))",
      ]
    )
  }

  let limitClause = ''
  if (Number.isInteger(limit)) {
    queryParams.limit = parseInt(limit, 10)
    limitClause = `LIMIT @limit`
  }

  const rows = await submitQuery({
    query: [selectStatement, filters.length ? `WHERE ${filters.join(' OR ')}` : null, limitClause]
      .filter((c) => !!c)
      .join('\n'),
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

/**
 * @param {string} id
 * @param {{config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneById = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const geneRecord = await resolveGene(id, { config })

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}`
  const select = `SELECT * FROM ${table}`
  const filter = 'UPPER(gene_id) = UPPER(@id)'

  const [gene] = await submitQuery({
    query: [select, `WHERE ${filter}`].join('\n'),
    options: { ...queryOptions, params: { id: geneRecord.id || id } },
  })

  return gene
}

/**
 * @param {string} id
 * @param {{
 *  cellTypeIds?: string[],
 *  rounds?: number[],
 *  fdr?: number,
 *  limit?: number,
 *  config?: object
 * }} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneAssociations = async (
  id,
  { cellTypeIds = [], rounds = [], fdr = 0.05, limit = 25, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  // Gene was not studied, which is different from no associations from being found which instead
  // will return an empty array
  const gene = await resolveGene(id, { config })
  if (!gene) return null

  // Gene is included in the study, continue to query associations
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  // NOTE: table cluster order is gene_id, cell_type_id, round. These filters should always
  // occur in this order to improve query performance and reduce cost. All other filters should
  // occur after.
  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`
  const select = `SELECT * FROM ${table}`
  const filters = [`UPPER(${ASSOCIATION_GENE_ID_COLUMN}) = UPPER(@id)`]

  const queryParams = { id: gene.id }

  // Add filter for matching cell type ids
  if (cellTypeIds?.length && Array.isArray(cellTypeIds)) {
    queryParams.cellTypeIds = cellTypeIds.map((s) => s.toString().toLowerCase())
    filters.push('LOWER(cell_type_id) IN UNNEST(@cellTypeIds)')
  }

  // Add filter for conditioning round
  if (rounds?.length && Array.isArray(rounds)) {
    queryParams.rounds = rounds.map(parseInt)
    filters.push('round IN UNNEST(@rounds)')
  }

  // Add filter for FDR
  if (Number.isFinite(fdr)) {
    queryParams.fdr = parseFloat(fdr)
    filters.push('fdr <= @fdr')
  }

  // Add clause for row limit. Default to serving all rows if no limit is provided.
  let limitClause = ''
  if (Number.isInteger(limit)) {
    queryParams.limit = parseInt(limit, 10)
    limitClause = 'LIMIT @limit'
  }

  const rows = await submitQuery({
    query: [select, filters.length ? `WHERE ${filters.join(' AND ')}` : null, limitClause]
      .filter((c) => !!c)
      .join('\n'),
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

/**
 * @param {string} id
 * @param {{config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneExpression = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const gene = await resolveGene(id, { config })
  if (!gene) return null

  // compute distributions
  const cellTypes = await fetchCellTypes({ config })

  const min = 5
  const max = 15

  const distributions = cellTypes.map((c) => {
    const skew = sampleNormal({ min: 0, max: 5, skew: 2 })
    return {
      id: c.cell_type_id,
      data: new Array(10000).fill(0).map(() => sampleNormal({ min, max, skew })),
    }
  })

  // Compute bin widths
  const nBins = 40
  const step = (max - min) / nBins
  const bins = new Array(nBins).fill(0).map((_, i) => {
    return { min: min + step * i, max: min + step * (i + 1) }
  })

  // Compute bin counts
  const histograms = distributions.map((d) => {
    return {
      id: d.id,
      counts: bins.map((b) => {
        return d.data.filter((n) => n >= b.min && n < b.max).length
      }),
    }
  })

  // Compute box plot statistic
  const statistics = distributions.map((d) => {
    const [q1, median, q3] = quantileSeq(d.data, [0.25, 0.5, 0.75])
    const iqr = q3 - q1

    return {
      id: d.id,
      min: Math.min(...d.data),
      max: Math.max(...d.data),
      mean: mean(d.data),
      median,
      q1,
      q3,
      iqr,
      iqr_min: q1 - 1.5 * iqr,
      iqr_max: q3 + 1.5 * iqr,
    }
  })

  return {
    histograms,
    bins,
    statistics,
  }
}

/**
 * @param {string} id
 * @param {{config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneAssociationAggregate = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  // Gene was not studied, which is different from no associations from being found which instead
  // will return an empty array
  const gene = await resolveGene(id, { config })
  if (!gene) return null

  const cellTypes = await fetchCellTypes({ config })

  return cellTypes.map((c) => {
    const skew = sampleNormal({ min: 1, max: 4, skew: 1 })
    return {
      gene_id: gene.id,
      gene_symbol: gene.symbol,
      cell_type_id: c.cell_type_id || c.id,
      min_p_value: sampleNormal({ min: 0, max: 1e4, skew: 6 }) / 1e4,
      mean_log_cpm: sampleNormal({ min: 0, max: 15, skew }),
    }
  })
}

module.exports = {
  fetchGenes,
  fetchGeneById,
  fetchGeneAssociations,
  fetchGeneAssociationAggregate,
  fetchGeneExpression,
  resolveGene,
  resolveGenes,
}
