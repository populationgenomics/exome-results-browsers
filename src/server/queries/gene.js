const { groupBy, sortBy } = require('lodash')

const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')
const { isGeneSymbol } = require('../identifiers')
const { ExpressionOptions } = require('./options')

/**
 * @param {string} symbol
 *
 * @returns {Promise<{gene_id: string, symbol: string}|null>}
 */
const resolveGene = async (query, { config = {} } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const sqlQuery = `
  SELECT
    DISTINCT gene_id, symbol
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}
  WHERE
    UPPER(gene_id) = UPPER(@query)
    OR UPPER(symbol) = UPPER(@query)`

  const [gene] = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: { query } },
  })

  return gene
}

const fetchGenes = async (query, { limit = 25, config = {} } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  let sqlQuery = `
  SELECT
    gene_id,
    symbol
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}`

  const queryParams = {}
  if (query) {
    queryParams.query = query
    sqlQuery += `
    WHERE
      UPPER(gene_id) = UPPER(@query)
      OR UPPER(canonical_transcript_id) = UPPER(@query)
      OR UPPER(symbol) = @query
      OR REGEXP_CONTAINS(UPPER(symbol), CONCAT('^', @query))
      OR REGEXP_CONTAINS(UPPER(gene_id), CONCAT('^', @query))`
  }

  if (Number.isInteger(limit)) {
    queryParams.limit = parseInt(limit)
    sqlQuery += `\nLIMIT @limit`
  }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGeneById = async (id, { config = {} } = {}) => {
  if (!id) return null

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  if (isGeneSymbol(id)) {
    const gene = await resolveGene(id, config)
    if (!gene) return null
    id = gene?.gene_id
  }

  const query = `
  SELECT
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}
  WHERE
    UPPER(gene_id) = UPPER(@id)`

  const [gene] = await submitQuery({
    query: query,
    options: { ...queryOptions, params: { id } },
  })

  return gene
}

/**
 * @param {string} id
 *
 * @returns {Promise<object|null>}
 */
const fetchGeneAssociations = async (
  id,
  { cellTypeIds = [], rounds = [], limit = 25, fdr = 0.05, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  // Gene was not studied, which is different from no associations from being found which instead
  // will return an empty array
  const gene = await resolveGene(id, config)
  if (!gene) return null
  id = gene?.gene_id

  // Gene is included in the study, continue to query associations
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  let query = `
  SELECT 
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}
  WHERE
    UPPER(ensembl_gene_id) = UPPER(@id)`

  const queryParams = { id }

  // Add filter for matching cell type ids
  if (cellTypeIds?.length && Array.isArray(cellTypeIds)) {
    queryParams.cellTypeIds = cellTypeIds.map((s) => s.toString())
    query += ` AND LOWER(cell_type_id) IN UNNEST(@cellTypeIds)`
  }

  // Add filter for conditioning round
  if (rounds?.length && Array.isArray(rounds)) {
    queryParams.rounds = rounds.map(parseInt)
    query += ` AND round IN UNNEST(@rounds)`
  }

  // Add filter for FDR
  if (Number.isFinite(fdr)) {
    queryParams.fdr = parseFloat(fdr)
    query += ` AND fdr <= @fdr`
  }

  // Add clause for row limit. Default to serving all rows if no limit is provided.
  if (Number.isInteger(limit)) {
    queryParams.limit = parseInt(limit)
    query += `\n  LIMIT @limit`
  }

  const rows = await submitQuery({
    query: query,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGeneExpression = async (
  id,
  { type = ExpressionOptions.choices.log_cpm, nBins = 30, config = {} } = {}
) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  // Gene was not studied, which is different from no associations from being found which instead
  // will return an empty array
  const gene = await resolveGene(id, config)
  if (!gene) return null
  // id = gene?.gene_id // TODO: Enable once table has gene_id column

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

  const queryParams = { id, nBins, type: type.trim().toLowerCase() }

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

const fetchGeneAssociationAggregate = async (id, { config = {} } = {}) => {
  if (!id) throw new Error("Parameter 'id' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const query = ``

  const queryParams = { id: id.trim().toUpperCase() }

  const rows = await submitQuery({
    query: query,
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
}
