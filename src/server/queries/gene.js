/* eslint-disable no-unused-vars */

const { mean } = require('lodash')
const { quantileSeq } = require('mathjs')

const { tableIds, defaultQueryOptions, submitQuery, sampleNormal } = require('./utilities')
const { fetchCellTypes } = require('./cellType')
const { fetchAssociations } = require('./association')
const { resolveGene, resolveGenes } = require('./gene_lookup')

/**
 * @param {{
 *  query?: string,
 *  range?: {chrom?: string, start?: number, stop?: number},
 *  expand?: boolean,
 *  limit?: number,
 *  config?: object
 * }} options
 *
 * @returns {Promise<object[]>}
 */
const fetchGenes = async ({
  query = null,
  range = { chrom: null, start: null, stop: null },
  expand = false,
  limit = 25,
  config = {},
} = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}`
  const columns = expand ? '*' : 'DISTINCT gene_id, symbol'
  const selectStatement = `SELECT ${columns} FROM ${table}`

  const queryParams = {}
  const filters = []

  if (range && Number.isInteger(range.start) && Number.isInteger(range.stop)) {
    queryParams.start = Number.parseInt(range.start, 10)
    queryParams.stop = Number.parseInt(range.stop, 10)
    filters.push(
      [
        '(',
        [
          '(global_start >= @start AND global_stop <= @stop)',
          '(global_start <= @start AND global_stop >= @start AND global_stop <= @stop)',
          '(global_start >= @start AND global_start <= @stop AND global_stop >= @stop)',
          '(global_start <= @start AND global_stop >= @stop)',
        ].join(' OR '),
        ')',
      ].join('')
    )
  }

  if (query) {
    queryParams.query = query
    filters.push(
      [
        '(',
        [
          'UPPER(gene_id) = UPPER(@query)',
          'UPPER(canonical_transcript_id) = UPPER(@query)',
          `UPPER(symbol) = UPPER(@query)`,
          `REGEXP_CONTAINS(UPPER(symbol), CONCAT('^', UPPER(@query)))`,
          "REGEXP_CONTAINS(UPPER(gene_id), CONCAT('^', UPPER(@query)))",
        ].join(' OR '),
        ')',
      ].join('')
    )
  }

  if (range && range.chrom) {
    queryParams.chrom = range.chrom
    filters.push('chrom = @chrom')
  }

  let limitClause = ''
  if (Number.isInteger(limit)) {
    queryParams.limit = parseInt(limit, 10)
    limitClause = `LIMIT @limit`
  }

  const rows = await submitQuery({
    query: [selectStatement, filters.length ? `WHERE ${filters.join(' AND ')}` : null, limitClause]
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
  if (!geneRecord) return null

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
 * @param {{config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGenesById = async (ids, { config = {} } = {}) => {
  if (!ids) return []

  const geneRecords = await resolveGenes(ids, { config })
  if (!geneRecords?.length) return []

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }
  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}`
  const select = `SELECT * FROM ${table}`
  const filter = 'UPPER(gene_id) IN UNNEST(@ids)'

  const genes = await submitQuery({
    query: [select, `WHERE ${filter}`].join('\n'),
    options: { ...queryOptions, params: { ids: geneRecords.map((g) => g.id.toUpperCase()) } },
  })

  return genes
}

/**
 * @param {string} id
 * @param {{
 *  cellTypeIds?: string[],
 *  rounds?: number[],
 *  fdr?: number,
 *  limit?: number,
 *  ldReference?: string,
 *  config?: object
 * }} options
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneAssociations = async (
  id,
  { cellTypeIds = [], rounds = [], fdr = 0.05, limit = 25, ldReference = null, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")
  const gene = await resolveGene(id, { config })
  if (!gene) return null

  const rows = await fetchAssociations({
    genes: [id],
    cellTypeIds,
    rounds,
    fdr,
    limit,
    ldReference,
    config,
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

  // Compute bin counts and distribution statistics
  const histograms = distributions.map((d) => {
    const [q1, median, q3] = quantileSeq(d.data, [0.25, 0.5, 0.75])
    const iqr = q3 - q1

    return {
      id: d.id,
      counts: bins.map((b) => {
        return d.data.filter((n) => n >= b.min && n < b.max).length
      }),
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
    const pval = sampleNormal({ min: 0, max: 1e4, skew: 6 }) / 1e4
    return {
      gene_id: gene.id,
      gene_symbol: gene.symbol,
      cell_type_id: c.cell_type_id || c.id,
      min_p_value: pval,
      log10_min_p_value: -Math.log10(pval),
      mean_log_cpm: sampleNormal({ min: 0, max: 15, skew }),
    }
  })
}

module.exports = {
  fetchGenes,
  fetchGeneById,
  fetchGenesById,
  fetchGeneAssociations,
  fetchGeneAssociationAggregate,
  fetchGeneExpression,
}
