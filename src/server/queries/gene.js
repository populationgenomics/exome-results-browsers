const { groupBy, sortBy } = require('lodash')

const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')
const { parseNumber } = require('../utils')

const fetchGenes = async ({ query, limit, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const queryParams = { limit: parseNumber(limit, 10) }

  let sqlQuery = `
  SELECT
    gene_id,
    symbol
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}
  `

  if (query?.trim()) {
    queryParams[query] = query.trim().toUpperCase()
    sqlQuery += `
    WHERE
      gene_id = @query
      OR canonical_transcript_id = @query
      OR UPPER(symbol) = @query
    `
  }

  if (queryParams.limit) {
    sqlQuery += ` 
    LIMIT @limit 
    `
  }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGeneById = async ({ geneId, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  if (!geneId || !geneId?.trim()) return null

  const query = `
  SELECT
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}
  WHERE
    gene_id = @id
  `

  const queryParams = { id: geneId.trim().toUpperCase() }

  const rows = await submitQuery({
    query: query,
    options: { ...queryOptions, params: queryParams },
  })

  return rows[0]
}

const fetchGeneAssociations = async ({ geneId, limit, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  if (!geneId || !geneId?.trim()) return null

  const gene = await submitQuery({
    query: `
    SELECT 
      * 
    FROM     
      ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}
    WHERE
      gene_id = @id
    `,
    options: { ...queryOptions, params: { id: gene.trim().toUpperCase() } },
  })

  // Gene was not studied, which is different from no associations from being found which instead
  // will return an empty array
  if (gene[0] == null) return null

  // Gene is included in the study, continue to query associations
  const query = `
  SELECT 
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}
  WHERE
    ensembl_gene_id = @id
  `

  const queryParams = { id: geneId.trim().toUpperCase() }
  if (parseNumber(limit)) {
    queryParams.limit = parseNumber(limit)
    sqlQuery += ` 
    LIMIT @limit 
    `
  }

  const rows = await submitQuery({
    query: query,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGeneExpression = async ({ geneId, type, nBins, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const expression_column = (type ?? 'log_cpm').toLowerCase()
  const numBins = Math.max(parseNumber(nBins, 30) - 1, 1)

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
        MIN(${expression_column}) min, 
        MAX(${expression_column}) max
      FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}
      WHERE gene = @geneId
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
      APPROX_QUANTILES(${expression_column}, 4) quantiles,
    FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}
    WHERE gene = @geneId 
    GROUP BY cell_type_id
  )
  `

  const histogramQuery = `
  WITH data AS (
    SELECT *
    FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}
    WHERE gene = @geneId
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
    data.${expression_column} >= bins.min AND data.${expression_column} < bins.max
  )
  GROUP BY bin_index, cell_type_id
  ORDER BY cell_type_id, bin_index
  `

  const queryParams = { geneId, nBins: numBins }

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
    bins: sortedBins.map((b) => {
      return { min: b.min, max: b.max }
    }),
    statistics,
  }
}

const fetchGeneAssociationAggregate = async ({ geneId, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  if (!geneId || !geneId?.trim()) return null

  const query = ``

  const queryParams = { id: geneId.trim().toUpperCase() }

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
