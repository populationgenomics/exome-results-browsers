const { submitQuery, defaultQueryOptions, tableIds } = require('./utilities')

const { config: serverConfig } = require('../config')

const GENE_SYMBOL_COLUMN = serverConfig.enableNewDatabase ? 'gene_symbol' : 'symbol'

/**
 * @param {string} query
 * @param {{config?: object}} options
 *
 * @returns {Promise<{id: string, symbol: string}|null>}
 */
const resolveGene = async (query, { config = {} } = {}) => {
  if (!query) throw new Error("Parameter 'query' is required.")

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}`
  const selectStatement = `SELECT DISTINCT gene_id id, ${GENE_SYMBOL_COLUMN} symbol FROM ${table}`
  const filters = ['UPPER(gene_id) = UPPER(@query)', `UPPER(${GENE_SYMBOL_COLUMN}) = UPPER(@query)`]
  const sqlQuery = [selectStatement, filters.length ? `WHERE ${filters.join(' OR ')}` : null]
    .filter((c) => !!c)
    .join('\n')

  const [gene] = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: { query: query.toString().toUpperCase() } },
  })

  return gene
}

/**
 * @param {string[]} queries
 * @param {{config?: object}} options
 *
 * @returns {Promise<{id: string, symbol: string}[]>}
 */
const resolveGenes = async (queries, { config = {} } = {}) => {
  if (!queries) return []

  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.geneLookup}`
  const selectStatement = `SELECT DISTINCT gene_id id, ${GENE_SYMBOL_COLUMN} symbol FROM ${table}`
  const filters = [
    'UPPER(gene_id) IN UNNEST(@queries)',
    `UPPER(${GENE_SYMBOL_COLUMN}) IN UNNEST(@queries)`,
  ]
  const sqlQuery = [selectStatement, filters.length ? `WHERE ${filters.join(' OR ')}` : null]
    .filter((c) => !!c)
    .join('\n')

  const genes = await submitQuery({
    query: sqlQuery,
    options: {
      ...queryOptions,
      params: { queries: queries.map((s) => s.toString().toUpperCase()) },
    },
  })

  return genes
}

module.exports = { resolveGene, resolveGenes }
