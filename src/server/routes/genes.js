/* eslint-disable no-unused-vars */

const express = require('express')

const { fetchGeneIdSuggestions } = require('../queries/gene')

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
  app.use('/api/genes/', (req, res) => {
    return fetchGeneIdSuggestions({ query: req.query.search }).then((data) =>
      res.status(200).json({ data })
    )
  })
}

module.exports = { setup }
