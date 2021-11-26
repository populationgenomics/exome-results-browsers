const { BigQuery } = require('@google-cloud/bigquery')

const { convertPositionToGlobalPosition, ReferenceGenome } = require('./utilities')

const PROJECT_ID = 'tob-wgs-browser'

const DEFAULT_QUERY_OPTIONS = {
  verbose: process.env.NODE_ENV === 'development',
  datasetId: ReferenceGenome.default(),
}

class Table {
  static tables = {
    eqtl: 'eqtl',
    esnp: 'esnp',
    logResidual: 'log_residual',
    cellType: 'cell_type',
    geneAnnotation: 'gene_annotation',
  }

  static tableIds() {
    return Array.from(Object.values(this.tables))
  }

  constructor({ tableId, datasetId = ReferenceGenome.default(), projectId = PROJECT_ID }) {
    this.projectId = projectId
    this.datasetId = datasetId || ReferenceGenome.default()
    this.tableId = tableId.toString().toLowerCase()

    if (datasetId === ReferenceGenome.grch38()) {
      throw new Error('GRCh38 is not yet supported')
    }

    if (!Table.tableIds().includes(this.tableId)) {
      throw new Error(
        `Table '${this.tableId}' does not exist. Choose from one of ${this.tableIds().join(', ')}`
      )
    }
  }

  path() {
    return `${this.projectId}.${this.datasetId}.${this.tableId}`
  }
}

const submitQuery = async ({ query, options }) => {
  // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
  const client = new BigQuery()

  const verbose = options.verbose || false
  if (verbose) {
    // eslint-disable-next-line no-console
    console.debug(query)
  }

  // Remove options that are not BigQuery options
  const overrides = { ...options }
  delete overrides.verbose
  delete overrides.datasetId

  // Send job and await results. These methods return arrays.
  const [job] = await client.createQueryJob({
    query,
    location: 'australia-southeast1',
    useLegacySql: false, // Must be turned off to use parameterized queries.
    allowLargeResults: true,
    useQueryCache: true,
    ...overrides,
  })

  const [rows] = await job.getQueryResults()

  return rows
}

const fetchGeneIdSuggestions = async ({ query, options = DEFAULT_QUERY_OPTIONS }) => {
  const table = new Table({ tableId: Table.tables.eqtl, datasetId: options.datasetId })

  let labelColumn = 'gene'
  if (new RegExp('^ENSG').test(query)) {
    labelColumn = 'ensembl_gene_id'
  }

  const sqlQuery = `
  SELECT
    DISTINCT
      ${labelColumn} AS label,
      CONCAT('/gene/', ensembl_gene_id) AS url
  FROM
    ${table.path()}
  WHERE
      gene LIKE CONCAT(@query, '%')
    OR
      ensembl_gene_id LIKE CONCAT(@query, '%')
  LIMIT
    10
`
  const results = await submitQuery({
    query: sqlQuery,
    options: { ...options, params: { query } },
  })

  return results
}

const fetchVariantIdSuggestions = async ({ query, options = DEFAULT_QUERY_OPTIONS }) => {
  const table = new Table({ tableId: Table.tables.eqtl, datasetId: options.datasetId })

  const sqlQuery = `
    SELECT
      variant_id as label,
      CONCAT('/variant/', variant_id) as url
    FROM 
      (
        SELECT
          rsid,
          CONCAT(chr, '-', bp, '-', a1, '-', a2) AS variant_id
        FROM
          ${table.path()}
      )
    WHERE
      variant_id LIKE CONCAT(@query, '%')
    LIMIT
      10
  `

  const results = await submitQuery({
    query: sqlQuery,
    options: { ...options, params: { query } },
  })

  return results
}

const fetchGenesInRegion = async ({ region, round = 1, options = DEFAULT_QUERY_OPTIONS }) => {
  const table = new Table({ tableId: Table.tables.eqtl, datasetId: options.datasetId })

  const sqlQuery = `
  SELECT
    DISTINCT(gene)
  FROM
    ${table.path()}
  WHERE
      g_bp >= @start
    AND
      g_bp <= @stop
    AND
      round = @round
`
  const params = {
    start: region.start,
    stop: region.stop,
    round,
  }

  const result = await submitQuery({ query: sqlQuery, options: { ...options, params } })

  return result.map((record) => record.gene)
}

const fetchAnnotationsForGene = async ({ gene, options = DEFAULT_QUERY_OPTIONS }) => {
  const table = new Table({ tableId: Table.tables.geneAnnotation, datasetId: options.datasetId })

  const sqlQuery = `
    SELECT

  `

  const params = {}

  const result = await submitQuery({ query: sqlQuery, options: { ...options, params } })

  return result
}

const fetchAssociationHeatmap = async ({
  region,
  round = 1,
  aggregateBy = 'q_value',
  options = DEFAULT_QUERY_OPTIONS,
}) => {
  const table = new Table({ tableId: Table.tables.eqtl, datasetId: options.datasetId })

  const sqlQuery = `
    SELECT
      DISTINCT
        gene AS geneName,
        cell_type_id AS cellTypeId,
      q_value AS value
    FROM
      (
        SELECT
          *,
          MIN(${aggregateBy}) OVER (PARTITION BY gene, cell_type_id) AS minValue
        FROM
          ${table.path()}
        WHERE
            g_bp >= @start
          AND
            g_bp <= @stop
          AND
            chr = @chrom
          AND
            round = @round
      )
    WHERE
      q_value = minValue
  `

  const params = {
    start: region.start,
    stop: region.stop,
    chrom: parseInt(region.chrom, 10),
    round,
  }

  const results = await submitQuery({ query: sqlQuery, options: { ...options, params } })

  const minValue = results.reduce((min, r) => Math.min(min, r.value), Number.MAX_SAFE_INTEGER)
  const maxValue = results.reduce((max, r) => Math.max(max, r.value), Number.MIN_SAFE_INTEGER)
  const geneNames = results.map((r) => r.geneName)
  const cellTypeIds = Array.from(new Set(results.map((r) => r.cellTypeId))).sort()

  return { geneNames, cellTypeIds, range: { minValue, maxValue }, data: results }
}

module.exports = {
  fetchGeneIdSuggestions,
  fetchAssociationHeatmap,
  fetchGenesInRegion,
  fetchVariantIdSuggestions,
  convertPositionToGlobalPosition,
}
