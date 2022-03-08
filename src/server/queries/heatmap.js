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
const { isGene } = require('../identifiers')

const generateRegionQuery = ({
  query,
  round = 1,
  aggregateBy = 'p_value',
  projectId = projectIds.tobWgsBrowser,
  datasetId = datasetIds.grch37,
}) => {
  const region = convertPositionToGlobalPosition({ ...parseRegionId(query) })

  const sqlQuery = `
    SELECT
      DISTINCT gene, cell_type_id,
      ${aggregateBy} AS value
    FROM
      (
        SELECT
          *,
          MIN(${aggregateBy}) OVER (PARTITION BY gene, cell_type_id) AS min_value
        FROM
          ${projectId}.${datasetId}.${tableIds.association}
        WHERE
          global_bp >= @start
          AND global_bp <= @stop
          AND chrom = @chrom
          AND round = @round
      )
    WHERE
      ${aggregateBy} = min_value
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
  aggregateBy = 'p_value',
  projectId = projectIds.tobWgsBrowser,
  datasetId = datasetIds.grch37,
}) => {
  const variant = parseVariantId(query)

  const sqlQuery = `
    SELECT
      DISTINCT gene, cell_type_id,
      ${aggregateBy} AS value
    FROM
      (
        SELECT
          *,
          MIN(${aggregateBy}) OVER (PARTITION BY gene, cell_type_id) AS min_value
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
              AND chrom = @chrom
              AND bp = @pos
              AND a1 = @ref
              AND a2 = @alt
          )
      )
    WHERE
      ${aggregateBy} = min_value
  `

  const params = {
    round,
    chrom: variant.chrom,
    pos: variant.pos,
    ref: variant.ref,
    alt: variant.alt,
  }

  return { query: sqlQuery, params }
}

const generateGeneQuery = ({
  query,
  round = 1,
  aggregateBy = 'p_value',
  projectId = projectIds.tobWgsBrowser,
  datasetId = datasetIds.grch37,
}) => {
  const gene = query?.toString()?.toUpperCase() || ''

  const sqlQuery = `
      DECLARE start DEFAULT (
         SELECT global_start 
         FROM ${projectId}.${datasetId}.${tableIds.geneModel}
         WHERE gene_id = @gene
         LIMIT 1
       );

       DECLARE stop DEFAULT (
         SELECT global_stop 
         FROM ${projectId}.${datasetId}.${tableIds.geneModel}
         WHERE gene_id = @gene
         LIMIT 1
       );

      SELECT
        DISTINCT gene, cell_type_id,
        ${aggregateBy} AS value
      FROM
        (
          SELECT
            *,
            MIN(${aggregateBy}) OVER (PARTITION BY ensembl_gene_id, cell_type_id) AS min_value
          FROM
            ${projectId}.${datasetId}.${tableIds.association}
          WHERE
              global_bp >= start
              AND global_bp <= stop
              AND ensembl_gene_id = @gene
              AND round = @round
        )
      WHERE
        ${aggregateBy} = min_value
    `

  const params = { gene, round }

  return { query: sqlQuery, params }
}

const generateRsidQuery = ({
  query,
  round = 1,
  aggregateBy = 'p_value',
  projectId = projectIds.tobWgsBrowser,
  datasetId = datasetIds.grch37,
}) => {
  const variant = query.toString().toLowerCase()

  const sqlQuery = `
      SELECT
        DISTINCT gene, cell_type_id,
        ${aggregateBy} AS value
      FROM
        (
          SELECT
            *,
            MIN(${aggregateBy}) OVER (PARTITION BY gene, cell_type_id) AS min_value
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
                AND rsid = @rsid
            )
        )
      WHERE
        ${aggregateBy} = min_value
    `

  const params = { rsid: variant, round }

  return { query: sqlQuery, params }
}

const fetchAssociationHeatmap = async ({ query, round = 1, aggregateBy = 'p_value', options }) => {
  const queryOptions = { ...defaultQueryOptions(), ...options }

  let generator = null
  if (isRegionId(query)) {
    generator = generateRegionQuery
  } else if (isVariantId(query)) {
    generator = generateVariantQuery
  } else if (isRsId(query)) {
    generator = generateRsidQuery
  } else if (isGene(query)) {
    generator = generateGeneQuery
  } else {
    throw new Error('Query must be a gene, region, variant ID or rsid')
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

  const cellTypeIds = (
    await submitQuery({
      query: `
      SELECT DISTINCT cell_type_id
      FROM ${queryOptions.projectId}.${queryOptions.datasetId}.${tableIds.association}
    `,
      options: { ...queryOptions },
    })
  )
    .map((d) => d.cell_type_id)
    .sort()

  const minValue = rows.reduce((min, r) => Math.min(min, r.value), Number.MAX_SAFE_INTEGER)
  const maxValue = rows.reduce((max, r) => Math.max(max, r.value), Number.MIN_SAFE_INTEGER)
  const geneNames = Array.from(new Set(rows.map((r) => r.gene))).sort()

  const squareData = [...rows]
  if (squareData.length > 0) {
    cellTypeIds.forEach((id) => {
      geneNames.forEach((name) => {
        if (!squareData.find((d) => d.gene === name && d.cell_type_id === id)) {
          squareData.push({ gene: name, cell_type_id: id, value: null })
        }
      })
    })
  }

  return {
    gene_names: geneNames,
    cell_type_ids: Array.from(new Set(cellTypeIds)).sort(),
    range: { min: minValue, max: maxValue },
    data: squareData,
  }
}

module.exports = {
  fetchAssociationHeatmap,
}
