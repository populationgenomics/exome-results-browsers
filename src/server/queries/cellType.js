const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

const fetchCellTypes = async ({ config } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  const query = `
  SELECT 
    *
  FROM 
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}
  `

  const rows = await submitQuery({ query, options: queryOptions })

  return rows
}

const fetchCellTypeById = async (id, { config = {} } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...(config || {}) }

  if (!id) return null

  const query = `
  SELECT 
    *
  FROM 
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}
  WHERE
    UPPER(id) = UPPER(@id)
  `

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
