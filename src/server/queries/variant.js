/* eslint-disable no-unused-vars */
const { ExpressionOptions } = require('./options')
const { defaultQueryOptions, tableIds, submitQuery } = require('./utilities')

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
        "UPPER(id) LIKE CONCAT('%', UPPER(@query), '%')",
        "UPPER(locus_id) LIKE CONCAT('%', UPPER(@query), '%')",
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
  const filters = ['UPPER(id) = UPPER(@id)']

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

  const sourceTable = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.variant}`
  const joinTable = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`
  const selectClause = `SELECT * FROM ${sourceTable} AS t1`
  const joinClause = `LEFT JOIN ${joinTable} AS t2 ON t1.id = t2.id`

  const queryParams = { id }
  const filters = ['UPPER(id) = UPPER(@id)']

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
 * @param {{type?: string, config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchVariantAssociationAggregate = async (
  id,
  { type = ExpressionOptions.choices.log_cpm, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")
  return null

  // const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  // const query = ``

  // const queryParams = { id }

  // const rows = await submitQuery({
  //   query,
  //   options: { ...queryOptions, params: queryParams },
  // })

  // return rows[0]
}

module.exports = {
  fetchVariants,
  fetchVariantById,
  fetchVariantAssociations,
  fetchVariantAssociationAggregate,
}
