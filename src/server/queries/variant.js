/* eslint-disable no-unused-vars */
const { parseVariantId } = require('@gnomad/identifiers')

const { fetchCellTypes } = require('./cellType')
const { fetchGenes } = require('./gene')
const { convertPositionToGlobalPosition } = require('./genome')
const { defaultQueryOptions, tableIds, submitQuery, sampleNormal } = require('./utilities')

/**
 * Fetch variant rows using an optional query to match variant ids or rsids. Provide a
 * range object with global base coordinates for efficient range based filtering.
 *
 * @returns {Promise<object[]|null>}
 */
const fetchVariants = async ({
  query = null,
  range = { chrom: null, start: null, stop: null },
  limit = 25,
  config = {},
} = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const queryParams = {}
  const filters = []

  if (range && Number.isInteger(range.start)) {
    queryParams.start = Number.parseInt(range.start, 10)
    filters.push('global_bp >= @start')
  }

  if (range && Number.isInteger(range.stop)) {
    queryParams.stop = Number.parseInt(range.stop, 10)
    filters.push('global_bp <= @stop')
  }

  if (query) {
    queryParams.query = query
    filters.push(
      [
        "UPPER(variant_id) LIKE CONCAT('%', UPPER(@query), '%')",
        "UPPER(snp_id) LIKE CONCAT('%', UPPER(@query), '%')",
        "UPPER(rsid) LIKE CONCAT('%', UPPER(@query), '%')",
      ].join(' OR ')
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

  const selectClause = 'SELECT *'
  const fromClause = `FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.variant}`

  const sqlQuery = [
    selectClause,
    fromClause,
    filters.length ? `WHERE ${filters.join(' AND ')}` : null,
    limitClause,
  ]
    .filter((c) => !!c)
    .join('\n')

  const rows = await submitQuery({
    query: sqlQuery,
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
const fetchVariantById = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const selectClause = 'SELECT *'
  const fromClause = `FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.variant}`
  const filters = ['UPPER(variant_id) = UPPER(@id)']

  const queryParams = { id }
  const sqlQuery = [
    selectClause,
    fromClause,
    filters.length ? `WHERE ${filters.join(' AND ')}` : null,
  ]
    .filter((c) => !!c)
    .join('\n')

  const [variant] = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return variant
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
 * @returns {Promise<object[]|null>}
 */
const fetchVariantAssociations = async (
  id,
  { cellTypeIds = [], rounds = [], fdr = 0.05, limit = 25, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  // Gene is included in the study, continue to query associations
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const variant = parseVariantId(id)
  const { start: pos } = convertPositionToGlobalPosition({
    chrom: variant.chrom,
    start: variant.pos,
    stop: variant.pos,
  })

  const sourceTable = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`
  const joinTable = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.variant}`
  const selectClause = `SELECT * FROM ${sourceTable} AS t1`
  const joinClause = `LEFT JOIN ${joinTable} AS t2 ON t1.variant_id = t2.variant_id`

  const queryParams = { id, pos }
  const filters = ['t1.global_bp = @pos', 'UPPER(t1.variant_id) = UPPER(@id)']

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
    limitClause = `LIMIT @limit`
  }

  const sqlQuery = [
    selectClause,
    joinClause,
    filters.length ? `WHERE ${filters.join(' AND ')}` : null,
    limitClause,
  ]
    .filter((c) => !!c)
    .join('\n')

  const rows = await submitQuery({
    query: sqlQuery,
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
const fetchVariantAssociationAggregate = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const cellTypes = await fetchCellTypes({ config })
  const genes = await fetchGenes({ limit: 10, expand: false })

  return cellTypes.map((c) => {
    return genes.map((g) => {
      const skew = sampleNormal({ min: 1, max: 4, skew: 1 })
      return {
        gene_id: g.gene_id,
        gene_symbol: g.symbol,
        cell_type_id: c.cell_type_id || c.id,
        min_p_value: sampleNormal({ min: 0, max: 1e4, skew: 6 }) / 1e4,
        mean_log_cpm: sampleNormal({ min: 0, max: 15, skew }),
      }
    })
  })
}

module.exports = {
  fetchVariants,
  fetchVariantById,
  fetchVariantAssociations,
  fetchVariantAssociationAggregate,
}
