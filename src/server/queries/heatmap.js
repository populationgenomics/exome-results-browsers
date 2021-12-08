const {
  isRegionId,
  isVariantId,
  isRsId,
  parseRegionId,
  parseVariantId,
} = require('@gnomad/identifiers')

const {
  tableIds,
  projectIds,
  datasetIds,
  defaultQueryOptions,
  submitQuery,
} = require('./utilities')
const { convertPositionToGlobalPosition } = require('./genome')

const generateRegionQuery = ({
  query,
  round = 1,
  aggregateBy = 'q_value',
  projectId = projectIds.tobWgsBrowser,
  datasetId = datasetIds.grch37,
}) => {
  const region = convertPositionToGlobalPosition({ ...parseRegionId(query) })

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
          ${projectId}.${datasetId}.${tableIds.association}
        WHERE
            global_bp >= @start
          AND
            global_bp <= @stop
          AND
            chrom = @chrom
          AND
            round = @round
      )
    WHERE
      q_value = minValue
  `

  const params = {
    round,
    start: region.start,
    stop: region.stop,
    chrom: region.chrom,
  }

  return { query: sqlQuery, params }
}

const generateVariantQuery = ({
  query,
  round = 1,
  aggregateBy = 'q_value',
  projectId = projectIds.tobWgsBrowser,
  datasetId = datasetIds.grch37,
}) => {
  const variant = parseVariantId(query)

  const sqlQuery = `
    SELECT
      DISTINCT
        gene AS geneName,
        cell_type_id AS cellTypeId,
      ${aggregateBy} AS value
    FROM
      (
        SELECT
          *,
          MIN(${aggregateBy}) OVER (PARTITION BY gene, cell_type_id) AS minValue
        FROM
          (
            SELECT
              gene,
              cell_type_id,
              round,
              ${aggregateBy}
            FROM
              ${projectId}.${datasetId}.${tableIds.association}
            WHERE
                round = @round
              AND
                chrom = @chrom
              AND
                bp = @pos
              AND
                a1 = @ref
              AND
                a2 = @alt
          )
      )
    WHERE
      ${aggregateBy} = minValue
  `

  const params = {
    round,
    chrom: parseInt(variant.chrom, 10),
    pos: variant.pos,
    ref: variant.ref,
    alt: variant.alt,
  }

  return { query: sqlQuery, params }
}

const generateRsidQuery = ({
  query,
  round = 1,
  aggregateBy = 'q_value',
  projectId = projectIds.tobWgsBrowser,
  datasetId = datasetIds.grch37,
}) => {
  const variant = query.toString().toLowerCase()

  const sqlQuery = `
      SELECT
        DISTINCT
          gene AS geneName,
          cell_type_id AS cellTypeId,
        ${aggregateBy} AS value
      FROM
        (
          SELECT
            *,
            MIN(${aggregateBy}) OVER (PARTITION BY gene, cell_type_id) AS minValue
          FROM
            (
              SELECT
                gene,
                cell_type_id,
                ${aggregateBy},
                rsid
              FROM
                ${projectId}.${datasetId}.${tableIds.association}
              WHERE
                  round = @round
                AND
                  rsid = @rsid
            )
        )
      WHERE
        ${aggregateBy} = minValue
    `

  const params = { rsid: variant, round }

  return { query: sqlQuery, params }
}

const fetchAssociationHeatmap = async ({ query, round = 1, aggregateBy = 'q_value', options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  let generator = null
  if (isRegionId(query)) {
    generator = generateRegionQuery
  } else if (isVariantId(query)) {
    generator = generateVariantQuery
  } else if (isRsId(query)) {
    generator = generateRsidQuery
  } else {
    throw new Error('Query must be a region, variant ID or Rsid')
  }

  const sqlQuery = generator({
    query,
    round,
    aggregateBy,
    datasetId: queryOptions.datasetId,
    projectId: queryOptions.projectId,
  })

  const rows = await submitQuery({
    query: sqlQuery.query,
    options: { ...queryOptions, params: sqlQuery.params },
  })

  const minValue = rows.reduce((min, r) => Math.min(min, r.value), Number.MAX_SAFE_INTEGER)
  const maxValue = rows.reduce((max, r) => Math.max(max, r.value), Number.MIN_SAFE_INTEGER)
  const geneNames = rows.map((r) => r.geneName)
  const cellTypeIds = Array.from(new Set(rows.map((r) => r.cellTypeId))).sort()

  return { geneNames, cellTypeIds, range: { minValue, maxValue }, data: rows }
}

module.exports = {
  fetchAssociationHeatmap,
}
