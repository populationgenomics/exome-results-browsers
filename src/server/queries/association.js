/* eslint-disable no-unused-vars */

const lodash = require('lodash')
const { quantileSeq } = require('mathjs')

const { config: serverConfig } = require('../config')

const { convertPositionToGlobalPosition } = require('./genome')
const {
  tableIds,
  defaultQueryOptions,
  submitQuery,
  parseAssociationId,
  sampleNormal,
} = require('./utilities')

const GENE_ID_COLUMN = serverConfig.enableNewDatabase ? 'gene_id' : 'ensembl_gene_id'
const GENE_SYMBOL_COLUMN = serverConfig.enableNewDatabase ? 'gene_symbol' : 'gene'

const SEP = '-'
const ASSOCIATION_ID_FORMULA = `CONCAT(chrom, '${SEP}', bp, '${SEP}', a1, '${SEP}', a2, '${SEP}', gene_id, '${SEP}', cell_type_id, '${SEP}', round)`
const VARIANT_ID_FORMULA = `CONCAT(chrom, '${SEP}', bp, '${SEP}', a1, '${SEP}', a2)`

/**
 * @param {{
 *  genes?: string[],
 *  cellTypeIds?: string[],
 *  variantIds: string[],
 *  rounds?: number[],
 *  fdr?: number,
 *  ids?: string[],
 *  range?: {chrom?: string | null, start?: number | null, stop?: number | null},
 *  ldReference?: string,
 *  limit?: number,
 *  config?: object
 * }} options
 *
 * @returns {Promise<object[]>}
 */
const fetchAssociations = async ({
  genes = [],
  cellTypeIds = [],
  variantIds = [],
  rounds = [],
  fdr = 0.05,
  range = { chrom: null, start: null, stop: null },
  ldReference = null,
  limit = 25,
  config = {},
} = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`

  // TODO: Implement LD reference scores
  let selectClause = `
  SELECT 
    *,
    ${ASSOCIATION_ID_FORMULA} association_id,
    ${VARIANT_ID_FORMULA} variant_id,
    NULL ld, 
    NULL ld_reference,
  FROM ${table}
  `
  if (ldReference) {
    selectClause = `
    SELECT 
      *, 
      ${ASSOCIATION_ID_FORMULA} association_id,
      ${VARIANT_ID_FORMULA} variant_id,
      RAND() ld, 
      "${ldReference}" ld_reference 
    FROM ${table}
    `
  }

  const queryParams = {}
  const filters = []

  // NOTE: Order of filter clauses follows table column cluster order to minimise cost. Range
  // query comes first since the table is partitioned on global coordinates.

  // Add filters for range query
  const hasRangeStart = range && Number.isInteger(range.start)
  if (hasRangeStart) {
    queryParams.start = Number.parseInt(range.start, 10)
    filters.push('global_bp >= @start')
  }

  const hasRangeStop = range && Number.isInteger(range.stop)
  if (hasRangeStop) {
    queryParams.stop = Number.parseInt(range.stop, 10)
    filters.push('global_bp <= @stop')
  }

  // Add filter for matching gene ids
  if (genes?.length && Array.isArray(genes)) {
    // FIXME: circular dependency with gene.js queries... something, something bad.
    // eslint-disable-next-line global-require
    const { fetchGenesById } = require('./gene')

    // Optimise queries based on genes by setting a range query for each gene.
    const geneRecords = await fetchGenesById(genes, { config })
    const rangeFilters = geneRecords
      .map((record) => {
        const start = record.global_start - 0.5e6
        const stop = record.global_stop + 0.5e6
        const geneRangeFilters = []

        if (!hasRangeStart && Number.isInteger(start)) {
          queryParams[`${record.gene_id}Start`] = start
          geneRangeFilters.push(`global_bp >= @${record.gene_id}Start`)
        }

        if (!hasRangeStop && Number.isInteger(stop)) {
          queryParams[`${record.gene_id}Stop`] = stop
          geneRangeFilters.push(`global_bp <= @${record.gene_id}Stop`)

          return `(${geneRangeFilters.join(' AND ')})`
        }

        return null
      })
      .filter((f) => !!f)

    if (rangeFilters.length) {
      filters.push(`(${rangeFilters.join(' OR ')})`)
    }

    filters.push(`UPPER(${GENE_ID_COLUMN}) IN UNNEST(@genes)`)
    queryParams.genes = geneRecords?.length
      ? geneRecords.map((g) => g.gene_id.toString().toUpperCase())
      : genes
  }

  // Add filter for matching cell type ids
  if (cellTypeIds?.length && Array.isArray(cellTypeIds)) {
    queryParams.cellTypeIds = cellTypeIds.map((s) => s.toString().toLowerCase())
    filters.push('LOWER(cell_type_id) IN UNNEST(@cellTypeIds)')
  }

  // Add filter for conditioning round
  if (rounds?.length && Array.isArray(rounds)) {
    queryParams.rounds = rounds.map((x) => x.toString()) // FIXME: rounds.map(parseInt)
    filters.push('round IN UNNEST(@rounds)')
  }

  // NOTE:  These oher filters have no order, they just need to come at the end.

  // Add filter for chromosome number.
  // TODO: Can optimise performance by converting this to a range query over entire chromosome.
  if (range && range.chrom) {
    queryParams.chrom = range.chrom
    filters.push('chrom = @chrom')
  }

  // Filter for variant ids
  if (variantIds?.length) {
    queryParams.variantIds = variantIds.map((id) => id.toString().toUpperCase())
    filters.push(`UPPER(${VARIANT_ID_FORMULA}) IN UNNEST(@variantIds)`)
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

  const associationRecord = parseAssociationId(id)
  const region = convertPositionToGlobalPosition({
    chrom: associationRecord.chrom,
    start: associationRecord.pos,
    stop: associationRecord.pos,
    reference: queryOptions.reference,
  })

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}`
  const selectClause = `
  SELECT 
    *, 
    ${ASSOCIATION_ID_FORMULA} association_id,
    ${VARIANT_ID_FORMULA} variant_id
  FROM ${table}
  `
  const filters = [
    'global_bp = @pos',
    `(UPPER(${GENE_ID_COLUMN}) = UPPER(@gene) OR UPPER(${GENE_SYMBOL_COLUMN}) = UPPER(@gene))`,
    'UPPER(cell_type_id) = UPPER(@cell)',
    `UPPER(${ASSOCIATION_ID_FORMULA}) = UPPER(@id)`,
  ]

  const queryParams = {
    id,
    pos: region.start,
    gene: associationRecord.gene,
    cell: associationRecord.cell,
  }
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
 * @param {{config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchAssociationEffect = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const association = parseAssociationId(id)
  const region = convertPositionToGlobalPosition({
    chrom: association.chrom,
    start: association.pos,
    stop: association.pos,
    reference: queryOptions.reference,
  })

  const genotypes = [
    `${association.ref}${association.ref}`,
    `${association.ref}${association.alt}`,
    `${association.alt}${association.alt}`,
  ]

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.effect}`
  const sqlQuery = `
  SELECT *
  FROM ${table}
  WHERE
    global_bp = @global_bp AND
    chrom = @chrom AND
    a1 = @ref AND
    a2 = @alt AND
    (UPPER(${GENE_ID_COLUMN}) = UPPER(@gene) OR UPPER(${GENE_SYMBOL_COLUMN}) = UPPER(@gene)) AND
    LOWER(cell_type_id) = LOWER(@cell_type_id)
  `

  const queryParams = {
    global_bp: region.start,
    chrom: region.chrom,
    ref: association.ref,
    alt: association.alt,
    gene: association.gene,
    cell_type_id: association.cell,
  }

  const results = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  const records = results.map((r) => {
    const flatBins = r.struct.bin_edges.list.map((i) => i.item)

    const bins = []
    for (let i = 0; i < flatBins.length - 1; i += 1) {
      bins.push({ min: flatBins[i], max: flatBins[i + 1] })
    }

    const record = {
      ...r.struct,
      id: r.genotype,
      gene_id: r.gene_id,
      gene_symbol: r.gene_symbol,
      bins,
      counts: r.struct.bin_counts.list.map((i) => i.item),
    }

    delete record.bin_edges // remove original unformatted data
    delete record.bin_counts // remove original unformatted data
    return record
  })

  return records.sort((a, b) => a.id - b.id)
}

module.exports = {
  fetchAssociations,
  fetchAssociationById,
  fetchAssociationEffect,
}
