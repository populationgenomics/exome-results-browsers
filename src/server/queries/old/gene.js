const { groupBy, sortBy, mapValues } = require('lodash')

const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

// TODO: This is slow, put gene names and ids in separate table.
const fetchGeneIdSuggestions = async ({ query, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  let labelColumn = 'symbol'
  if (new RegExp('^ENSG').test(query)) {
    labelColumn = 'gene_id'
  }

  let filter = ''
  if (query) {
    filter = `
    WHERE
      REGEXP_CONTAINS(UPPER(${labelColumn}), CONCAT('^', @query))
    `.trim()
  }

  const sqlQuery = `
  SELECT
    ${labelColumn} AS label, 
    CONCAT('/results/', gene_id) AS url
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}
  ${filter}
  LIMIT
    10
`
  const queryParams = { query: query?.toUpperCase() }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGenesInRegion = async ({ region, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const sqlQuery = `
  SELECT
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel} 
  WHERE
    chrom = @chrom
    AND (
      (start >= @start AND stop <= @stop)
        OR (start <= @start AND stop >= @start AND stop <= @stop)
        OR (start >= @start AND start <= @stop AND stop >= @stop)
        OR (start <= @start AND stop >= @stop)
    )
  `

  const queryParams = {
    start: region.start,
    stop: region.stop,
    chrom: region.chrom,
  }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGenesAssociatedWithVariant = async ({ variant, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const sqlQuery = `
  SELECT
    *,
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel} AS X
  INNER JOIN (
    SELECT
      DISTINCT ensembl_gene_id
    FROM
      ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association} 
    WHERE
      bp = @bp
      AND chrom = @chrom
      AND a1 = @ref
      AND a2 = @alt
  ) AS Y
  ON X.gene_id = Y.ensembl_gene_id
  `

  const queryParams = {
    chrom: variant.chrom,
    bp: variant.pos,
    ref: variant.ref,
    alt: variant.alt,
  }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGenes = async ({ query, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  // Fallback to first N rows if no query has been specified
  let queryParams = {}
  let sqlQuery = `
  SELECT
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}
  LIMIT 10
  `

  if (query?.trim()) {
    sqlQuery = `
    SELECT
      *
    FROM
      ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}
    WHERE
      gene_id IN UNNEST(@listQuery)
      OR canonical_transcript_id IN UNNEST(@listQuery)
      OR UPPER(symbol) IN UNNEST(@listQuery)
      OR REGEXP_CONTAINS(UPPER(search_terms), CONCAT('".*', @textQuery, '.*"'))
      OR REGEXP_CONTAINS(UPPER(name), CONCAT('.*', @textQuery, '.*'))
    `

    queryParams = {
      listQuery: query
        .trim()
        .split(',')
        .filter((q) => q?.trim() != null)
        .map((q) => q.toUpperCase()),
      textQuery: query.trim().toUpperCase(),
    }
  }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGenesById = async ({ ids, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const formattedIds = ids?.filter((q) => q?.trim() != null)?.map((q) => q.toUpperCase())
  if (!formattedIds) return []

  const sqlQuery = `
  SELECT
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneModel}
  WHERE
    gene_id IN UNNEST(@ids)
  `

  const queryParams = { ids: formattedIds }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return rows
}

const fetchGeneExpression = async ({ gene, cellTypesIds, chroms, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const formattedCellTypeIds = cellTypesIds
    ?.filter((q) => q?.trim() != null)
    ?.map((q) => q.toLowerCase())

  const formattedChroms = chroms?.filter((q) => q?.trim() != null)?.map((q) => q.toLowerCase())

  let sqlQuery = `
  SELECT
    gene,
    chrom,
    cell_type_id,
    residual
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.expression}
  WHERE
    LOWER(gene) = LOWER(@gene) 
  `

  const queryParams = { gene }

  if (formattedCellTypeIds.length) {
    sqlQuery += `AND LOWER(cell_type_id) IN UNNEST(@cellTypeIds)`
    queryParams.cellTypeIds = formattedCellTypeIds
  }

  if (formattedChroms.length) {
    sqlQuery += `AND LOWER(chrom) IN UNNEST(@chroms)`
    queryParams.chroms = formattedChroms
  }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: queryParams },
  })

  return mapValues(
    groupBy(rows, (r) => r.cell_type_id),
    (a) => a.map((r) => r.residual)
  )
}

const fetchExpression = async ({ geneId, type, nBins, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const expression_column = (type ?? 'log_cpm').toLowerCase()
  const numBins = Math.max((Number.parseInt(nBins) ?? 30) - 1, 1)

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

module.exports = {
  fetchGeneIdSuggestions,
  fetchGenesInRegion,
  fetchGenes,
  fetchGenesAssociatedWithVariant,
  fetchGenesById,
  fetchGeneExpression,
  fetchExpression,
}
