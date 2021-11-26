const { parseRegionId, parseVariantId } = require('@gnomad/identifiers')
const { convertPositionToGlobalPosition } = require('./utilities')

const generateRegionQuery = ({ query, round = 1, aggregateBy = 'q_value' }) => {
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
          @@table
        WHERE
            g_bp >= @start
          AND
            g_bp <= @stop
          AND
            chr = @chrom
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
    chrom: parseInt(region.chrom, 10),
  }

  return { query: sqlQuery, params }
}

const generateVariantQuery = ({ query, round = 1, aggregateBy = 'q_value' }) => {
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
              @@table
            WHERE
                round = @round
              AND
                chr = @chrom
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

const generateRsidQuery = ({ query, round = 1, aggregateBy = 'q_value' }) => {
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
                @@table
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

module.exports = {
  generateRegionQuery,
  generateVariantQuery,
  generateRsidQuery,
}
