/* eslint-disable no-unused-vars */

const express = require('express')

const { isRegionId, parseRegionId } = require('@gnomad/identifiers')

const queries = require('../queries/variant')
const { InvalidQueryParameter, NotFound } = require('../errors')
const { parseNumber } = require('../utils')
const { convertPositionToGlobalPosition } = require('../queries/genome')

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  /**
   * @swagger
   *  /api/variants:
   *    get:
   *      description: Returns a list of variants related to a given query
   *      tags:
   *        - Variants
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: query
   *          name: search
   *          description: Search string
   *          type: string
   *          example: rs62144825
   *        - in: query
   *          name: region
   *          description: Region identifier
   *          type: string
   *          example: 8:79587978-79717758
   *        - in: query
   *          name: limit
   *          description: Maximum number of results
   *          type: number
   *          format: int32
   *          example: 25
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *        400:
   *          description: Invalid region identifier
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/variants/', async (req, res, next) => {
    if (req.query.region && !isRegionId(req.query.region)) {
      return next(
        new InvalidQueryParameter(`Region '${req.query.region}' is not a valid region id`)
      )
    }

    const globalRange = isRegionId(req.query.region)
      ? convertPositionToGlobalPosition(parseRegionId(req.query.region))
      : { chrom: null, start: null, stop: null }

    const variants = await queries
      .fetchVariants({
        query: req.query.search,
        range: globalRange,
        limit: req.query.limit ? parseNumber(req.query.limit, 25) : null,
      })
      .catch(next)

    return res.status(200).json(variants)
  })

  /**
   * @swagger
   *  /api/variants/{id}:
   *    get:
   *      description: Returns details of a variant
   *      tags:
   *        - Variants
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Variant identifier
   *          required: true
   *          type: string
   *          example: 2-42752280-A-G
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *        404:
   *          description: Variant with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/variants/:id', async (req, res, next) => {
    const variant = await queries.fetchVariantById(req.params.id).catch(next)
    if (variant == null) return next(new NotFound('Variant not found'))
    return res.status(200).json(variant)
  })

  /**
   * @swagger
   *  /api/variants/{id}/associations:
   *    get:
   *      description: Returns all eQTL associations for a variant
   *      tags:
   *        - Variants
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Variant identifier
   *          required: true
   *          type: string
   *          example: 2-42752280-A-G
   *        - in: query
   *          name: cellTypes
   *          description: Cell type identifiers, comma delimited.
   *          type: string
   *          example: bin,bmem
   *        - in: query
   *          name: fdr
   *          description: Filter by FDR between 0 and 1
   *          type: number
   *          format: float
   *          example: null
   *        - in: query
   *          name: ld_reference
   *          description: Locus to display LD relative to
   *          type: string
   *          example: null
   *        - in: query
   *          name: rounds
   *          description: Conditioning rounds, comma delimited.
   *          type: string
   *          example: 1
   *        - in: query
   *          name: limit
   *          description: Maximum number of results
   *          type: number
   *          format: int32
   *          example: 25
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *        404:
   *          description: Variant with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/variants/:id/associations', async (req, res, next) => {
    const associations = await queries
      .fetchVariantAssociations(req.params.id, {
        cellTypeIds: (req.query.cellTypes?.split(',') || [])
          .map((s) => s.trim())
          .filter((s) => !!s),
        rounds: (req.query.rounds?.split(',') || []).map(parseInt).filter(Number.isInteger),
        ldReference: req.query.ld_reference,
        fdr: Number.isFinite(parseFloat(req.query.fdr)) ? parseFloat(req.query.fdr) : null,
        limit: req.query.limit ? parseNumber(req.query.limit, 25) : null,
      })
      .catch(next)

    if (associations == null) {
      return next(new NotFound('Variant not found'))
    }

    return res.status(200).json(associations)
  })

  /**
   * @swagger
   *  /api/variants/{id}/aggregate:
   *    get:
   *      description: 'Returns a summary of eQTL association information such as mean gene
   *        expression and minimum p-value across all cell types'
   *      tags:
   *        - Variants
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Variant identifier
   *          required: true
   *          type: string
   *          example: 2-42752280-A-G
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Aggregate'
   *        404:
   *          description: Variant with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/variants/:id/aggregate', async (req, res, next) => {
    const data = await queries.fetchVariantAssociationAggregate(req.params.id).catch(next)
    if (data == null) return next(new NotFound('Variant not found'))
    return res.status(200).json(data)
  })
}

module.exports = { setup }

// ---------------------------------------------------------------------------------------------- //
// Swagger Components
// ---------------------------------------------------------------------------------------------- //
