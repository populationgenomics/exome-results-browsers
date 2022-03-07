const { tableIds, defaultQueryOptions, submitQuery } = require('./utilities')

const fetchVariantsById = async ({ ids, options }) => {
  const queryOptions = { ...defaultQueryOptions(), options }

  if (!ids) return []

  const sqlQuery = `
  SELECT
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}
  WHERE
    id IN UNNEST(@ids)
  )
  `
  const sqlParams = { ids }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: sqlParams },
  })

  return rows
}

const fetchVariantsInRegion = async ({
  region,
  genes = null,
  cellTypes = null,
  round = 1,
  options,
}) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  const matchCellTypes = cellTypes?.length ? 'AND cell_type_id IN UNNEST(@cellTypes)' : ''
  const matchGenes = genes?.length
    ? 'AND (gene IN UNNEST(@genes) OR ensembl_gene_id IN UNNEST(@genes))'
    : ''

  const sqlQuery = `
  SELECT
    *
  FROM
    ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}
  WHERE
    global_bp >= @start
    AND global_bp <= @stop
    ${matchGenes}
    ${matchCellTypes} 
    AND round = @round
  `
  const sqlParams = {
    start: region.start,
    stop: region.stop,
    round,
  }

  if (matchGenes.length) {
    sqlParams.genes = genes
  }

  if (matchCellTypes.length) {
    sqlParams.cellTypes = cellTypes
  }

  const rows = await submitQuery({
    query: sqlQuery,
    options: { ...queryOptions, params: sqlParams },
  })

  return rows
}

module.exports = {
  fetchVariantsInRegion,
  fetchVariantsById,
}
