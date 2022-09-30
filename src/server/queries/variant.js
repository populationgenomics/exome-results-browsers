/* eslint-disable no-unused-vars */
const { uniqBy } = require('lodash')

const { parseVariantId, normalizeVariantId } = require('@gnomad/identifiers')
const { fetchAssociations } = require('./association')

const { fetchCellTypes } = require('./cellType')
const { fetchGenes } = require('./gene')
const { convertPositionToGlobalPosition } = require('./genome')
const { defaultQueryOptions, tableIds, submitQuery, sampleNormal } = require('./utilities')

const SEP = '-'
const VARIANT_ID_FORMULA = `CONCAT(chrom, '${SEP}', bp, '${SEP}', a1, '${SEP}', a2)`

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
    filters.push([`UPPER(${VARIANT_ID_FORMULA}) LIKE CONCAT('%', UPPER(@query), '%')`].join(' OR '))
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

  const selectClause = `SELECT *, ${VARIANT_ID_FORMULA} varaint_id`
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

  const selectClause = `SELECT *, ${VARIANT_ID_FORMULA} variant_id`
  const fromClause = `FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.variant}`
  const filters = [`UPPER(${VARIANT_ID_FORMULA}) = UPPER(@id)`]

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
 *  ldReference?: string,
 *  config?: object
 * }} options
 *
 * @returns {Promise<object[]|null>}
 */
const fetchVariantAssociations = async (
  id,
  { cellTypeIds = [], rounds = [], fdr = 0.05, limit = 25, ldReference = null, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const variant = parseVariantId(id)
  const globalCoordinates = convertPositionToGlobalPosition({
    chrom: variant.chrom,
    start: variant.pos,
    stop: variant.pos,
  })

  const rows = await fetchAssociations({
    cellTypeIds,
    variantIds: [normalizeVariantId(id)],
    range: {
      chrom: globalCoordinates.chrom,
      start: globalCoordinates.start - 1e6,
      stop: globalCoordinates.stop + 1e6,
    },
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
const fetchVariantAssociationAggregate = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const cellTypes = await fetchCellTypes({ config })

  const variant = parseVariantId(id)
  const globalCoordinates = convertPositionToGlobalPosition({
    chrom: variant.chrom,
    start: variant.pos,
    stop: variant.pos,
  })

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const query = `
  SELECT 
    t1.gene_id, 
    t1.gene_symbol, 
    t1.cell_type_id, 
    t1.data.mean AS mean_log_cpm, 
    min_p_value
  FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression} AS t1
  JOIN (
    SELECT 
      gene_id,
      cell_type_id,
      MIN(p_value) AS min_p_value 
    FROM (
      SELECT *
      FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}
      WHERE
        global_bp = @global_bp AND
        chrom = @chrom AND
        a1 = @ref AND
        a2 = @alt
    )
    GROUP BY gene_id, cell_type_id
  ) AS t2
  ON (t1.gene_id = t2.gene_id AND t1.cell_type_id = t2.cell_type_id)
  `

  const queryParams = {
    global_bp: globalCoordinates.start,
    chrom: globalCoordinates.chrom,
    ref: variant.ref,
    alt: variant.alt,
  }

  const results = await submitQuery({
    query,
    options: { ...queryOptions, params: queryParams },
  })

  const genes = uniqBy(
    results.map((r) => ({ gene_id: r.gene_id, gene_symbol: r.gene_symbol })),
    'gene_id'
  )

  genes.forEach((g) => {
    cellTypes.forEach((c) => {
      if (!results.find((r) => r.gene_id === g.gene_id && r.cell_type_id === c.cell_type_id)) {
        results.push({
          gene_id: g.gene_id,
          gene_symbol: g.gene_symbol,
          cell_type_id: c.cell_type_id,
          min_p_value: null,
          mean_log_cpm: null,
        })
      }
    })
  })

  return results.map((r) => {
    return {
      ...r,
      max_log10_p_value: Number.isFinite(r.min_p_value) ? -Math.log10(r.min_p_value) : null,
    }
  })
}

module.exports = {
  fetchVariants,
  fetchVariantById,
  fetchVariantAssociations,
  fetchVariantAssociationAggregate,
}
