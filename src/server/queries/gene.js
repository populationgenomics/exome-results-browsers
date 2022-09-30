/* eslint-disable no-unused-vars */

const { uniqBy } = require('lodash')

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

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }
  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}`
  const select = `SELECT * FROM ${table}`
  const filter = 'WHERE UPPER(gene_id) = UPPER(@id)'

  const results = await submitQuery({
    query: [select, filter].join('\n'),
    options: { ...queryOptions, params: { id } },
  })

  const records = results.map((r) => {
    const flatBins = r.data.bin_edges.list.map((i) => i.item)

    const bins = []
    for (let i = 0; i < flatBins.length - 1; i += 1) {
      bins.push({ min: flatBins[i], max: flatBins[i + 1] })
    }

    const record = {
      ...r.data,
      id: r.cell_type_id,
      gene_id: r.gene_id,
      gene_symbol: r.gene_symbol,
      bins,
      counts: r.data.bin_counts.list.map((i) => i.item),
    }

    delete record.bin_edges // remove original unformatted data
    delete record.bin_counts // remove original unformatted data
    return record
  })

  return records
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
  const gene = await fetchGeneById(id, { config })
  if (!gene) return null

  const cellTypes = await fetchCellTypes({ config })

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
        global_bp >= @start AND
        global_bp <= @stop AND
        gene_id = @id
    )
    GROUP BY gene_id, cell_type_id
  ) AS t2
  ON (t1.gene_id = t2.gene_id AND t1.cell_type_id = t2.cell_type_id)
  `

  const queryParams = {
    start: gene.global_start,
    stop: gene.global_stop,
    id: gene.gene_id,
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
  fetchGenes,
  fetchGeneById,
  fetchGenesById,
  fetchGeneAssociations,
  fetchGeneAssociationAggregate,
  fetchGeneExpression,
}
