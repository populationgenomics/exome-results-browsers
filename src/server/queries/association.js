/* eslint-disable no-unused-vars */

const lodash = require('lodash')
const { quantileSeq } = require('mathjs')

const { convertPositionToGlobalPosition } = require('./genome')
const { ExpressionOptions } = require('./options')
const {
  defaultQueryOptions,
  tableIds,
  submitQuery,
  parseAssociationId,
  sampleNormal,
} = require('./utilities')

const { config: serverConfig } = require('../config')
const { resolveGenes } = require('./gene')

const ASSOCIATION_ID_COLUMN = serverConfig.enableNewDatabase ? 'association_id' : 'id'
const GENE_ID_COLUMN = serverConfig.enableNewDatabase ? 'gene_id' : 'ensembl_gene_id'

/**
 * @param {{
 *  genes?: string[],
 *  cellTypeIds?: string[],
 *  rounds?: number[],
 *  fdr?: number,
 *  ids?: string[],
 *  range?: {chrom?: string | null, start?: number | null, stop?: number | null},
 *  limit?: number,
 *  config?: object
 * }} options
 *
 * @returns {Promise<object[]>}
 */
const fetchAssociations = async ({
  genes = [],
  cellTypeIds = [],
  rounds = [],
  fdr = 0.05,
  ids = [],
  range = { chrom: null, start: null, stop: null },
  limit = 25,
  config = {},
} = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`
  const selectClause = `SELECT * FROM ${table}`

  const queryParams = {}
  const filters = []

  // NOTE: Order of filter clauses follows table column cluster order to minimise cost. Range
  // query comes first since the table is partitioned on global coordinates.

  // Add filters for range query
  if (range && Number.isInteger(range.start)) {
    queryParams.start = Number.parseInt(range.start, 10)
    filters.push('global_bp >= @start')
  }

  if (range && Number.isInteger(range.stop)) {
    queryParams.stop = Number.parseInt(range.stop, 10)
    filters.push('global_bp <= @stop')
  }

  // Add filter for matching gene ids
  // TODO: change column name to gene_id
  if (genes?.length && Array.isArray(genes)) {
    const geneRecords = await resolveGenes(genes, { config })
    queryParams.genes = geneRecords.map((g) => g.gene_id.toString().toUpperCase())
    filters.push(`UPPER(${GENE_ID_COLUMN}) IN UNNEST(@genes)`)
  }

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

  // NOTE:  These oher filters have no order, they just need to come at the end.

  // Add filter for matching variant ids
  if (ids?.length && Array.isArray(ids)) {
    queryParams.ids = ids.map((s) => s.toString().toUpperCase())
    filters.push('UPPER(id) IN UNNEST(@ids)')
  }

  // Add filter for chromosome number.
  // TODO: Can optimise performance by converting this to a range query over entire chromosome.
  if (range && range.chrom) {
    queryParams.chrom = range.chrom
    filters.push('chrom = @chrom')
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

  const orderClause = 'ORDER BY fdr ASC'

  const sqlQuery = [
    selectClause,
    filters.length ? `WHERE ${filters.join(' AND ')}` : null,
    orderClause,
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
const fetchAssociationById = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const associationId = parseAssociationId(id)
  const region = convertPositionToGlobalPosition({
    chrom: associationId.chrom,
    start: associationId.pos,
    stop: associationId.pos,
    reference: queryOptions.datasetId,
  })

  // TODO: use gene_id column
  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`
  const selectClause = `SELECT * FROM ${table}`
  const filters = [
    'global_bp = @pos',
    `UPPER(${GENE_ID_COLUMN}) = UPPER(@gene)`,
    'UPPER(cell_type_id) = UPPER(@cell)',
    `UPPER(${ASSOCIATION_ID_COLUMN}) = UPPER(@id)`,
  ]

  const queryParams = { id, pos: region.start, gene: associationId.gene, cell: associationId.cell }
  const sqlQuery = [selectClause, filters.length ? `WHERE ${filters.join(' AND ')}` : null]
    .filter((c) => !!c)
    .join('\n')

  const [association] = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return association
}

/**
 * @param {string} id
 * @param {{type?: string, config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchAssociationEffect = async (
  id,
  { type = ExpressionOptions.choices.log_cpm, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const association = parseAssociationId(id)
  const genotypes = [
    `${association.ref}${association.ref}`,
    `${association.ref}${association.alt}`,
    `${association.alt}${association.alt}`,
  ]

  const min = 5
  const max = 15

  // compute distributions
  const distributions = genotypes.map((g) => {
    const skew = sampleNormal({ min: 0, max: 5, skew: 2 })
    return {
      id: g.toUpperCase(),
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
      mean: lodash.mean(d.data),
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

module.exports = {
  fetchAssociations,
  fetchAssociationById,
  fetchAssociationEffect,
}
