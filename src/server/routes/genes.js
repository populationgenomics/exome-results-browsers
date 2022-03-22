/* eslint-disable no-unused-vars */

const express = require('express')

const { isGene } = require('../identifiers')

const { fetchGeneIdSuggestions, fetchExpression } = require('../queries/gene')
const { InvalidQueryParameter, InvalidPathParameter } = require('../errors')

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  /**
   * @swagger
   *  /api/genes:
   *    get:
   *      description: Return a list of gene suggestions for a given query
   *      tags:
   *        - Genes
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: query
   *          name: search
   *          description: Search string
   *          type: string
   *          example: IL7
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                type: array
   *                items:
   *                  type: object
   *                  required:
   *                    - label
   *                    - url
   *                  properties:
   *                    label:
   *                      type: string
   *                    url:
   *                      type: string
   *        400:
   *          description: Bad request. A single query is required.
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   *        5XX:
   *          description: An unexpected error has occured
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/genes/', async (req, res, next) => {
    const genes = await fetchGeneIdSuggestions({ query: req.query.search }).catch(next)
    return res.status(200).json({ genes })
  })

  /**
   * @swagger
   *  /api/genes/{id}/expression:
   *    get:
   *      description: Return the binned expression across all cell-types associated with a gene
   *      tags:
   *        - Genes
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Ensembl gene id
   *          required: true
   *          type: string
   *          example: BRCA1
   *        - in: query
   *          name: type
   *          description: Type of expression data to count
   *          schema:
   *            type: string
   *            enum:
   *              - log_cpm
   *              - residual
   *          example: residual
   *        - in: query
   *          name: nBins
   *          description: Number of bins to use for histogram computation
   *          type: number
   *          example: 30
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/BinnedExpression'
   *        400:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/genes/:id/expression', async (req, res, next) => {
    // TODO: change residual to log_residual
    if (!isGene(req.params.id)) {
      next(new InvalidPathParameter('Please provide an Ensembl gene id'))
    }

    const expressionType = (req.query.type ?? 'residual')?.toLowerCase()
    if (!['residual', 'log_cpm'].includes(expressionType)) {
      next(
        new InvalidQueryParameter("Expression 'type' must be either 'log_cpm' or 'log_residual'")
      )
    }

    let nBins = parseInt(req.query.nBins) ?? 30
    if (nBins < 5) {
      next(new InvalidQueryParameter('A minimum of 5 bins is required'))
    }

    const data = await fetchExpression({
      geneId: req.params.id,
      type: expressionType,
      nBins,
    }).catch(next)

    res.status(200).json(data)
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
 *      BinnedExpression:
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
 *                - cell_type_id
 *                - counts
 *              properties:
 *                cell_type_id:
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
 *                - cell_type_id
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
 *                cell_type_id:
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
