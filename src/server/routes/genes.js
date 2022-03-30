/* eslint-disable no-unused-vars */

const express = require('express')

const queries = require('../queries/gene')
const { InvalidQueryParameter, NotFound } = require('../errors')
const { ExpressionOptions } = require('../queries/options')
const { parseNumber } = require('../utils')

// TODO: Throw 404 for when :id is not found in any database rows

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  /**
   * @swagger
   *  /api/genes:
   *    get:
   *      description: Returns a list of gene suggestions for a given query
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
   *        - in: query
   *          name: expand
   *          description: Return all database columns
   *          type: boolean
   *          example: false
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
   *                type: array
   *                items:
   *                  type: object
   *                  required:
   *                    - gene_id
   *                    - symbol
   *                  properties:
   *                    gene_id:
   *                      type: string
   *                    symbol:
   *                      type: string
   */
  app.get('/api/genes/', async (req, res, next) => {
    const genes = await queries
      .fetchGenes({
        query: req.query.search,
        expand: req.query.expand === 'true',
        limit: parseNumber(req.query.limit, 25),
      })
      .catch(next)
    res.status(200).json(genes)
  })

  /**
   * @swagger
   *  /api/genes/{id}:
   *    get:
   *      description: Returns details of a gene
   *      tags:
   *        - Genes
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          required: true
   *          description: Ensembl gene id or gene symbol
   *          type: string
   *          example: ENSG00000104432
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
  app.get('/api/genes/:id', async (req, res, next) => {
    const gene = await queries.fetchGeneById(req.params.id).catch(next)

    if (gene == null) {
      next(new NotFound('Gene not found'))
    }

    res.status(200).json(gene)
  })

  /**
   * @swagger
   *  /api/genes/{id}/associations:
   *    get:
   *      description: Returns all eQTL associations for a gene
   *      tags:
   *        - Genes
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          required: true
   *          description: Ensembl gene id or gene symbol
   *          type: string
   *          example: ENSG00000104432
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
   *          description: Gene with requested identifier does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/genes/:id/associations', async (req, res, next) => {
    const associations = await queries
      .fetchGeneAssociations(req.params.id, {
        cellTypeIds: (req.query.cellTypes?.split(',') || [])
          .map((s) => s.trim())
          .filter((s) => !!s),
        rounds: (req.query.rounds?.split(',') || []).map(parseInt).filter(Number.isInteger),
        fdr: Number.isFinite(parseFloat(req.query.fdr)) ? parseFloat(req.query.fdr) : null,
        limit: parseNumber(req.query.limit, 25),
      })
      .catch(next)

    if (associations == null) {
      next(new NotFound('Gene not found'))
    }

    res.status(200).json(associations)
  })

  /**
   * @swagger
   *  /api/genes/{id}/expression:
   *    get:
   *      description: Returns the binned expression across all cell-types associated with a gene
   *      tags:
   *        - Genes
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Ensembl gene id or gene symbol
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
   *          description: Invalid expression data type
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
  app.get('/api/genes/:id/expression', async (req, res, next) => {
    // TODO: change residual to log_residual
    const type = (req.query.type || ExpressionOptions.choices.residual).toString()
    if (!ExpressionOptions.isValid(type)) {
      next(
        new InvalidQueryParameter(
          `Value '${type}' for query parameter 'type' must be ` +
            `one of ${ExpressionOptions.toString()}`
        )
      )
    }

    const nBins = Number.parseInt(req.query.nBins, 10)
    if (!Number.isInteger(nBins) || nBins < 5) {
      next(new InvalidQueryParameter('A minimum of 5 bins is required'))
    }

    const data = await queries.fetchGeneExpression(req.params.id, { type, nBins }).catch(next)

    if (data == null) {
      next(new NotFound('Gene not found'))
    }

    res.status(200).json(data)
  })

  /**
   * @swagger
   *  /api/genes/{id}/aggregate:
   *    get:
   *      description: 'Returns a summary of eQTL association information such as mean gene
   *        expression and minimum p-value across all cell types'
   *      tags:
   *        - Genes
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          description: Ensembl gene id or gene symbol
   *          required: true
   *          type: string
   *          example: BRCA1
   *        - in: query
   *          name: type
   *          description: Type of expression data to summarise
   *          schema:
   *            type: string
   *            enum:
   *              - log_cpm
   *              - residual
   *          example: residual
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Aggregate'
   *        400:
   *          description: Invalid expression data type
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
  app.get('/api/genes/:id/aggregate', async (req, res, next) => {
    // TODO: change residual to log_residual
    const type = (req.query.type || ExpressionOptions.choices.residual).toString()
    if (!ExpressionOptions.isValid(type)) {
      next(
        new InvalidQueryParameter(
          `Value '${type}' for query parameter 'type' must be ` +
            `one of ${ExpressionOptions.toString()}`
        )
      )
    }

    const data = await queries.fetchGeneAssociationAggregate(req.params.id, { type }).catch(next)

    if (data == null) {
      next(new NotFound('Gene not found'))
    }

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
 *                - id
 *                - counts
 *              properties:
 *                id:
 *                  description: Group id (cell type or genotype id)
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
 *                - id
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
 *                id:
 *                  description: Group id (cell type or genotype id)
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

/**
 * @swagger
 *  components:
 *    schemas:
 *      Aggregate:
 *        type: array
 *        items:
 *          type: object
 *          required:
 *            - gene_id
 *            - gene_symbol
 *            - cell_type_id
 *            - min_p_value
 *            - mean_log_cpm
 *          properties:
 *            gene_id:
 *              type: string
 *            gene_symbol:
 *              type: string
 *            cell_type_id:
 *              type: string
 *            min_p_value:
 *              type: number
 *              format: float
 *            mean_log_cpm:
 *              type: number
 *              format: float
 */
