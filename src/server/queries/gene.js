/* eslint-disable no-unused-vars */

const { groupBy, sortBy } = require('lodash')

const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')
const { isGeneSymbol, isEnsemblGeneId } = require('../identifiers')
const { ExpressionOptions } = require('./options')

/**
 * @param {string} query
 * @param {{config?: object}} options
 *
 * @returns {Promise<{gene_id: string, symbol: string}|null>}
 */
const resolveGene = async (query, { config = {} } = {}) => {
  if (!query) throw new Error("Parameter 'query' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}`
  const selectStatement = `SELECT DISTINCT gene_id, symbol FROM ${table}`
  const filters = ['UPPER(gene_id) = UPPER(@query)', 'UPPER(symbol) = UPPER(@query)']
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
 * @returns {Promise<{gene_id: string, symbol: string}[]>}
 */
const resolveGenes = async (queries, { config = {} } = {}) => {
  if (!queries) throw new Error("Parameter 'query' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}`
  const selectStatement = `SELECT DISTINCT gene_id, symbol FROM ${table}`
  const filters = ['UPPER(gene_id) IN UNNEST(@queries)', 'UPPER(symbol) IN UNNEST(@queries)']
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
 * @param {{query?: string, limit?: number, config?: object}} options
 *
 * @returns {Promise<object[]>}
 */
const fetchGenes = async ({ query = null, limit = 25, config = {} } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}`
  const selectStatement = `SELECT DISTINCT gene_id, symbol FROM ${table}`

  const queryParams = {}
  const filters = []
  if (query) {
    queryParams.query = query
    filters.push(
      ...[
        'UPPER(gene_id) = UPPER(@query)',
        'UPPER(canonical_transcript_id) = UPPER(@query)',
        'UPPER(symbol) = @query',
        "REGEXP_CONTAINS(UPPER(symbol), CONCAT('^', @query))",
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

  let geneId = id
  if (isGeneSymbol(id)) {
    const gene = await resolveGene(id, config)
    if (!gene) return null
    geneId = gene.gene_id
  }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}`
  const select = `SELECT * FROM ${table}`
  const filter = 'UPPER(gene_id) = UPPER(@id)'

  const [gene] = await submitQuery({
    query: [select, `WHERE ${filter}`].join('\n'),
    options: { ...queryOptions, params: { id: geneId } },
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
  const geneId = id
  if (isGeneSymbol(id)) {
    const gene = await resolveGene(id, config)
    if (!gene) return null
    // TODO: resolve gene name when association table is indexed on gene id
    // geneId = gene.gene_id
  }

  // Gene is included in the study, continue to query associations
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  // NOTE: table cluster order is gene, cell_type_id, round. These filters should always
  // occur in this order to improve query performance and reduce cost. All other filters should
  // occur after.

  // TODO: cluster on gene_id instead.

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`
  const select = `SELECT * FROM ${table}`
  const filters = ['(UPPER(gene) = UPPER(@id) OR UPPER(ensembl_gene_id) = UPPER(@id))']

  const queryParams = { id: geneId }

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
 * @param {{type?: string, nBins?: number, config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneExpression = async (
  id,
  { type = ExpressionOptions.choices.log_cpm, nBins = 30, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  // Gene was not studied, which is different from no associations from being found which instead
  // will return an empty array
  const geneId = id
  if (isGeneSymbol(id)) {
    const gene = await resolveGene(id, config)
    if (!gene) return null
    // TODO: resolve gene name when association table is indexed on gene id
    // geneId = gene.gene_id
  }

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const binsQuery = `
  SELECT
    i index,
    (min + step * i) min, 
    (min + step * (i + 1)) max  
  FROM (
    SELECT 
      min, 
      max, 
      (max - min) diff, 
      ((max - min) / @nBins) step, 
      GENERATE_ARRAY(0, @nBins, 1) i
    FROM (
      SELECT 
        MIN(${type}) min, 
        MAX(${type}) max
      FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}
      WHERE gene = @id
    )
  ), UNNEST(i) i
  `

  const statsQuery = `
  SELECT
    cell_type_id,
    min,
    max, 
    mean,
    quantiles[SAFE_OFFSET(1)] as q1,
    quantiles[SAFE_OFFSET(2)] as median,
    quantiles[SAFE_OFFSET(3)] as q3,
    (quantiles[SAFE_OFFSET(3)] - quantiles[SAFE_OFFSET(1)]) as iqr,
    quantiles[SAFE_OFFSET(1)] - 1.5 * (quantiles[SAFE_OFFSET(3)] - quantiles[SAFE_OFFSET(1)]) as iqr_min,
    quantiles[SAFE_OFFSET(3)] + 1.5 * (quantiles[SAFE_OFFSET(3)] - quantiles[SAFE_OFFSET(1)]) as iqr_max,
  FROM (
    SELECT
      cell_type_id,
      MIN(residual) min,
      MAX(residual) max,
      AVG(residual) mean,
      APPROX_QUANTILES(${type}, 4) quantiles,
    FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}
    WHERE gene = @id 
    GROUP BY cell_type_id
  )
  `

  const histogramQuery = `
  WITH data AS (
    SELECT *
    FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}
    WHERE gene = @id
  ), 
  bins AS (
  ${binsQuery}
  )
  SELECT
    data.cell_type_id,        
    bins.index bin_index,
    COUNT(*) count
  FROM data  
  LEFT JOIN bins ON (
    data.${type} >= bins.min AND data.${type} < bins.max
  )
  GROUP BY bin_index, cell_type_id
  ORDER BY cell_type_id, bin_index
  `

  const queryParams = { id: geneId, nBins, type: type.trim().toLowerCase() }

  const bins = await submitQuery({
    query: binsQuery,
    options: { ...queryOptions, params: queryParams },
  })

  const statistics = await submitQuery({
    query: statsQuery,
    options: { ...queryOptions, params: queryParams },
  })

  const histograms = await submitQuery({
    query: histogramQuery,
    options: { ...queryOptions, params: queryParams },
  })

  // Query will omit bins where there is a zero count, so add these back in to make the data
  // square (ish).
  const sortedBins = sortBy(bins, (b) => b.index)
  const flattened = Object.entries(groupBy(histograms, (h) => h.cell_type_id)).map(
    ([cellTypeId, group]) => {
      const counts = []

      sortedBins
        .map((b) => b.index)
        .forEach((index) => {
          const binCounts = group.find((g) => g.bin_index === index)
          counts.push(binCounts?.count ?? 0)
        })

      return { cell_type_id: cellTypeId, counts }
    }
  )

  return {
    histograms: flattened,
    bins: flattened.length
      ? sortedBins.map((b) => {
          return { min: b.min, max: b.max }
        })
      : [],
    statistics,
  }
}

/**
 * @param {string} id
 * @param {{type?: string, config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneAssociationAggregate = async (
  id,
  { type = ExpressionOptions.choices.log_cpm, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const query = ``

  const queryParams = { id }

  const rows = await submitQuery({
    query,
    options: { ...queryOptions, params: queryParams },
  })

  return rows[0]
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
