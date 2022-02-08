const { groupBy, mapValues } = require('lodash')

const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

// TODO: This is slow, put gene names and ids in separate table.
const fetchGeneIdSuggestions = async ({ query, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  let labelColumn = 'symbol'
  if (new RegExp('^ENSG').test(query)) {
    labelColumn = 'gene_id'
  }

  const sqlQuery = `
  SELECT
    ${labelColumn} AS label, 
    CONCAT('/gene/', gene_id) AS url
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup} 
  WHERE
    REGEXP_CONTAINS(UPPER(${labelColumn}), CONCAT('^', @query))
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
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.logResidual}
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

module.exports = {
  fetchGeneIdSuggestions,
  fetchGenesInRegion,
  fetchGenes,
  fetchGenesAssociatedWithVariant,
  fetchGenesById,
  fetchGeneExpression,
}
