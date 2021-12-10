const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

const fetchCellTypes = async ({ options } = {}) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const sqlQuery = `
  SELECT 
    *
  FROM 
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}
  `

  const rows = await submitQuery({ query: sqlQuery, options: queryOptions })

  return rows
}

const fetchCellTypesById = async ({ ids, options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  if (!ids?.length) return []

  const sqlQuery = `
  SELECT 
    *
  FROM 
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.cellType}
  WHERE
    id IN UNNEST(@ids)
  `

  const sqlParams = { ids }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: sqlParams },
  })

  return rows
}

module.exports = {
  fetchCellTypes,
  fetchCellTypesById,
}
