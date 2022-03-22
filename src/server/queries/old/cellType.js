const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

const fetchCellTypes = async ({ options } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const query = `
  SELECT 
    *
  FROM 
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}
  `

  const rows = await submitQuery({ query, options: queryOptions })

  return rows
}

const fetchCellTypeById = async ({ id, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  if (!id) return null

  const query = `
  SELECT 
    *
  FROM 
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}
  WHERE
    id = @id
  `

  const queryParams = { id }

  const rows = await submitQuery({
    query,
    options: { ...queryOptions, params: queryParams },
  })

  return rows[0]
}

module.exports = {
  fetchCellTypes,
  fetchCellTypeById,
}
