/* eslint-disable no-unused-vars */
const { parseVariantId, normalizeVariantId } = require('@gnomad/identifiers')
const { fetchAssociations } = require('./association')

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
      start: globalCoordinates.start - 0.5e6,
      stop: globalCoordinates.stop + 0.5e6,
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
  const genes = await fetchGenes({ limit: 5, expand: false })

  return cellTypes.flatMap((c) => {
    return genes.map((g) => {
      const skew = sampleNormal({ min: 1, max: 4, skew: 1 })
      const pval = sampleNormal({ min: 0, max: 1e4, skew: 6 }) / 1e4
      return {
        gene_id: g.gene_id,
        gene_symbol: g.symbol,
        cell_type_id: c.cell_type_id || c.id,
        min_p_value: pval,
        log10_min_p_value: -Math.log10(pval),
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
