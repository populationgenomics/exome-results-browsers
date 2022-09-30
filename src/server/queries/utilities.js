/* eslint-disable no-console */

const { BigQuery } = require('@google-cloud/bigquery')

const { ReferenceGenome } = require('./genome')

// TODO: Define table schemas here

const tableIds = {
  association: 'association',
  expression: 'expression',
  effect: 'eqtl_effect',
  variant: 'variant',
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
    reference: process.env.REFERENCE_GENOME || datasetIds.grch38,
    datasetId: process.env.DATASET_ID || datasetIds.grch38,
    projectId: process.env.PROJECT_ID || projectIds.tobWgsBrowser,
  }
}

const parseConditioningRound = (value, min = 1, max = 6) => {
  if (!value || !Number.isInteger(Number.parseInt(value, 10))) return min

  const number = Number.parseInt(value, 10)
  if (number < min || number > max) {
    throw new Error(`Conditioning round must be a number between ${min} and ${max}`)
  }

  return parseInt(value, 10)
}

const submitQuery = async ({ query, options }) => {
  // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
  const client = new BigQuery()

  const verbose = options.verbose || false
  if (verbose) {
    console.debug('\n----------- QUERY ------------')
    console.debug(query)
    console.debug(options.params)
    console.debug('------------------------------\n')
  }

  // Remove options that are not BigQuery options
  const bigQueryOverrides = { ...options }
  const nonBigQueryOptions = ['verobse', 'reference', 'datasetId', 'projectId']
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

  if (verbose) {
    const metadata = await job.getMetadata()
    const queryInfo = metadata[0]?.statistics?.query || {}

    const keys = [
      ['estimatedBytesProcessed', (n) => (n == null ? n : `${n / 1e9} GB`)],
      ['totalBytesProcessed', (n) => (n == null ? n : `${n / 1e9} GB`)],
      ['totalBytesBilled', (n) => (n == null ? n : `${n / 1e9} GB`)],
      ['totalPartitionsProcessed', (n) => n],
      ['totalSlotMs', (n) => n],
      ['cacheHit', (n) => n],
      ['billingTier', (n) => n],
    ]

    console.group('\n------- Query metadata --------')
    keys.map(([key, formatter]) => console.info(`${key}: ${formatter(queryInfo[key]) ?? '?'}`))
    console.groupEnd()
    console.info('-------------------------------')
  }

  return rows
}

const parseAssociationId = (value) => {
  // const idRe = /^(\d+):(\d+):([ATCG]+):([ATCG]+):(ENSG\d{11}):([A-Z_]+):(\d+)$/i

  // if (!idRe.test(value.toString())) {
  //   throw new Error(`Association id '${value}' is not a valid identifier.`)
  // }
  let sep = ':'
  if (value.includes('-')) {
    sep = '-'
  }

  const [chrom, pos, ref, alt, gene, cell, round] = value.split(sep)
  return {
    chrom,
    pos: Number.parseInt(pos, 10),
    ref,
    alt,
    gene,
    cell,
    round: Number.parseInt(round, 10),
  }
}

/**
 * Adapted from https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
 *
 * @returns {number}
 */
const sampleNormal = ({ min = 0, max = 1, skew = 0 } = {}) => {
  let u = 0
  let v = 0

  // Converting [0,1) to (0,1)
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()

  // Apply the Box–Muller Transform
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)

  // Translate to 0 -> 1
  num = num / 10.0 + 0.5

  if (num > 1 || num < 0) {
    // resample between 0 and 1 if out of range
    num = sampleNormal({ min, max, skew })
  } else {
    // Apply the skew factor
    num **= skew // Skew
    // Stretch to fill range
    num *= max - min
    // Offset to min
    num += min
  }

  return num
}

module.exports = {
  tableIds,
  datasetIds,
  projectIds,
  defaultQueryOptions,
  parseConditioningRound,
  submitQuery,
  parseAssociationId,
  sampleNormal,
}
