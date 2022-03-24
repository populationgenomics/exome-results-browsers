/* eslint-disable no-unused-vars */

const { isRegionId, parseRegionId } = require('@gnomad/identifiers')
const express = require('express')
const { NotFound, InvalidQueryParameter, ServerError } = require('../errors')

const queries = require('../queries/association')
const { convertPositionToGlobalPosition } = require('../queries/genome')
const { parseNumber } = require('../utils')

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  /**
   * @swagger
   *  /api/associations:
   *    get:
   *      description: Return all eQTL associations for a query
   *      tags:
   *        - Associations
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: query
   *          name: genes
   *          description: Gene symbols or Ensembl identifiers, comma delimited
   *          type: string
   *          example: BRCA1
   *        - in: query
   *          name: cellTypes
   *          description: Cell type identifiers, comma delimited
   *          type: string
   *          example: bin,bmem
   *        - in: query
   *          name: region
   *          description: Region identifier
   *          type: string
   *          example: 17:41196312-41277500
   *        - in: query
   *          name: fdr
   *          description: Filter by FDR between 0 and 1
   *          type: number
   *          format: float
   *          example: null
   *        - in: query
   *          name: rounds
   *          description: Conditioning rounds, comma delimited
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
   *          description: Gene with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/associations', async (req, res, next) => {
    if (req.query.region && !isRegionId(req.query.region)) {
      return next(
        new InvalidQueryParameter(`Region '${req.query.region}' is not a valid region id`)
      )
    }

    const globalRange = isRegionId(req.query.region)
      ? convertPositionToGlobalPosition(parseRegionId(req.query.region))
      : { chrom: null, start: null, stop: null }

    const associations = await queries
      .fetchAssociations({
        genes: (req.query.genes?.split(',') || []).map((s) => s.trim()).filter((s) => !!s),
        cellTypeIds: (req.query.cellTypes?.split(',') || [])
          .map((s) => s.trim())
          .filter((s) => !!s),
        ids: (req.query.ids?.split(',') || []).map((s) => s.trim()).filter((s) => !!s),
        rounds: (req.query.rounds?.split(',') || []).map(parseInt).filter(Number.isInteger),
        range: globalRange,
        fdr: Number.isFinite(parseFloat(req.query.fdr)) ? parseFloat(req.query.fdr) : null,
        limit: parseNumber(req.query.limit, 25),
      })
      .catch(next)

    return res.status(200).json(associations)
  })

  /**
   * @swagger
   *  /api/associations/{id}:
   *    get:
   *      description: Return details of an eQTL association
   *      tags:
   *        - Associations
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          required: true
   *          description: Association identifier
   *          type: string
   *          example: 17:41216206:T:C:ARL4D:nk:1
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *        404:
   *          description: Association with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/associations/:id', async (req, res, next) => {
    const association = await queries.fetchAssociationById(req.params.id).catch(next)

    if (association == null) {
      next(new NotFound('Association not found'))
    }

    res.status(200).json(association)
  })

  /**
   * @swagger
   *  /api/associations/{id}/effect:
   *    get:
   *      description: Returns the binned expression for each genotype configuration
   *      tags:
   *        - Associations
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          required: true
   *          description: Association identifier
   *          type: string
   *          example: 17:41216206:T:C:ARL4D:nk:1
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/AssociationEffect'
   *        404:
   *          description: Association with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/associations/:id/effect', async (req, res, next) => {
    next(new ServerError('Route has not been implemented yet'))
  })
}

module.exports = { setup }

// ---------------------------------------------------------------------------------------------- //
// Swagger Components
// ---------------------------------------------------------------------------------------------- //

/**
 * @swagger
 *  components:
 *    schemas:
 *      AssociationEffect:
 *        type: object
 *        required:
 *          - histograms
 *          - bins
 *        properties:
 *          histograms:
 *            type: array
 *            items:
 *              type: object
 *              required:
 *                - genotype
 *                - counts
 *              properties:
 *                genotype:
 *                  type: string
 *                counts:
 *                  type: array
 *                  items:
 *                    type: number
 *                    format: int32
 *          bins:
 *            type: array
 *            items:
 *              type: object
 *              required:
 *                - min
 *                - max
 *              properties:
 *                min:
 *                  type: number
 *                  format: float
 *                max:
 *                  type: number
 *                  format: float
 *          statistics:
 *            type: array
 *            items:
 *              type: object
 *              required:
 *                - genotype
 *                - min
 *                - max
 *                - mean
 *                - q1
 *                - median
 *                - q3
 *                - iqr
 *                - iqr_min
 *                - iqr_max
 *              properties:
 *                genotype:
 *                  type: string
 *                min:
 *                  type: number
 *                  format: float
 *                max:
 *                  type: number
 *                  format: float
 *                mean:
 *                  type: number
 *                  format: float
 *                q1:
 *                  type: number
 *                  format: float
 *                median:
 *                  type: number
 *                  format: float
 *                q3:
 *                  type: number
 *                  format: float
 *                iqr:
 *                  type: number
 *                  format: float
 *                iqr_min:
 *                  type: number
 *                  format: float
 *                iqr_max:
 *                  type: number
 *                  format: float
 */
