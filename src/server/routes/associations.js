/* eslint-disable no-unused-vars */

const express = require('express')

const { isRegionId, parseRegionId } = require('@gnomad/identifiers')

const queries = require('../queries/association')
const { NotFound, InvalidQueryParameter } = require('../errors')
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
   *      description: Returns all eQTL associations for a query
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
   *          name: ld_reference
   *          description: Locus to display LD relative to
   *          type: string
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
   *        400:
   *          description: Invalid region identifier
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
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
        ldReference: req.query.ld_reference,
        fdr: Number.isFinite(parseFloat(req.query.fdr)) ? parseFloat(req.query.fdr) : null,
        limit: req.query.limit ? parseNumber(req.query.limit, 25) : null,
      })
      .catch(next)

    return res.status(200).json(associations)
  })

  /**
   * @swagger
   *  /api/associations/{id}:
   *    get:
   *      description: Returns details of an eQTL association
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
   *          example: 17:41216206:T:C:ENSG00000012048:nk:1
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
    if (association == null) return next(new NotFound('Association not found'))
    return res.status(200).json(association)
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
   *          example: 17:41216206:T:C:ENSG00000012048:nk:1
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/BinnedExpression'
   *        404:
   *          description: Association with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/associations/:id/effect', async (req, res, next) => {
    const effect = await queries.fetchAssociationEffect(req.params.id).catch(next)
    if (effect == null) return next(new NotFound('Association not found'))
    return res.status(200).json(effect)
  })
}

module.exports = { setup }

// ---------------------------------------------------------------------------------------------- //
// Swagger Components
// ---------------------------------------------------------------------------------------------- //
