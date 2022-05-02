const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

const { config: serverConfig } = require('../config')

const ID_COLUMN = serverConfig.enableNewDatabase ? 'cell_type_id' : 'id'

/**
 * @param {{config?: object}} options
 *
 * @returns {Promise<object[]>}
 */
const fetchCellTypes = async ({ config = {} } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}`
  const query = `SELECT * FROM ${table}`
  const rows = await submitQuery({ query, options: queryOptions })

  return rows
}

/**
 * @param {string} id
 * @param {{config?: object}} options
 *
 * @returns {Promise<object|null>}
 */
const fetchCellTypeById = async (id, { config = {} } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  if (!id) return null

  const table = `${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}`
  const select = `SELECT * FROM ${table}`
  const filter = `UPPER(${ID_COLUMN}) = UPPER(@id)`

  const query = `${select}\nWHERE ${filter}`
  const queryParams = { id }

  const [cellType] = await submitQuery({
    query,
    options: { ...queryOptions, params: queryParams },
  })

  return cellType
}

module.exports = {
  fetchCellTypes,
  fetchCellTypeById,
}
