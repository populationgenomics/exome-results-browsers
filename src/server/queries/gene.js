const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

// TODO: This is slow, put gene names and ids in separate table.
const fetchGeneIdSuggestions = async ({ query, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  let labelColumn = 'gene'
  if (new RegExp('^ENSG').test(query)) {
    labelColumn = 'ensembl_gene_id'
  }

  const sqlQuery = `
  SELECT
    ${labelColumn} AS label, 
    CONCAT('/gene/', ensembl_gene_id) AS url
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association} 
  WHERE
      UPPER(gene) LIKE CONCAT(UPPER(@query), '%')
    OR
      UPPER(ensembl_gene_id) LIKE CONCAT(UPPER(@query), '%')
  GROUP BY
    ${labelColumn},
    ensembl_gene_id
  LIMIT
    10
`
  const queryParams = { query }

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
      OR REGEXP_CONTAINS(UPPER(name), CONCAT('.*', @textQuery), '.*'))
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

module.exports = {
  fetchGeneIdSuggestions,
  fetchGenesInRegion,
  fetchGenes,
  fetchGenesAssociatedWithVariant,
  fetchGenesById,
}
