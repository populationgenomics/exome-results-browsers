const _ = require('lodash')
const { BigQuery } = require('@google-cloud/bigquery')

const { ReferenceGenome } = require('./genome')

const tableIds = {
  association: 'association',
  expression: 'log_residual',
  variant: 'variant',
  genotype: 'genotype',
  cellType: 'cell_type',
  geneModel: 'gene_model',
  geneLookup: 'gene_lookup',
}

const datasetIds = {
  grch37: ReferenceGenome.grch37(),
  grch38: ReferenceGenome.grch38(),
}

const projectIds = {
  tobWgsBrowser: 'tob-wgs-browser',
}

const defaultQueryOptions = () => {
  return {
    verbose: process.env.NODE_ENV === 'development',
    datasetId: process.env.DATASET_ID || datasetIds.grch37,
    projectId: process.env.PROJECT_ID || projectIds.tobWgsBrowser,
  }
}

const parseConditioningRound = (value) => {
  if (!value) return 1

  if (!Number.isInteger(value) && !_.range(1, 7).includes(parseInt(value, 10))) {
    throw new Error('Conditioning round must be a number between 1 and 6')
  }

  return parseInt(value, 10)
}

const submitQuery = async ({ query, options }) => {
  // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
  const client = new BigQuery()

  const verbose = options.verbose || false
  if (verbose) {
    // eslint-disable-next-line no-console
    console.debug(query)
    // eslint-disable-next-line no-console
    console.debug(options.params)
  }

  // Remove options that are not BigQuery options
  const bigQueryOverrides = { ...options }
  const nonBigQueryOptions = ['verobse', 'datasetId', 'projectId']
  nonBigQueryOptions.forEach((prop) => {
    delete bigQueryOverrides[prop]
  })

  // Send job and await results. These methods return arrays.
  const [job] = await client.createQueryJob({
    query,
    location: 'australia-southeast1',
    useLegacySql: false, // Must be turned off to use parameterized queries.
    allowLargeResults: true,
    useQueryCache: true,
    ...bigQueryOverrides,
  })

  const [rows] = await job.getQueryResults()

  return rows
}

module.exports = {
  tableIds,
  datasetIds,
  projectIds,
  defaultQueryOptions,
  parseConditioningRound,
  submitQuery,
}
