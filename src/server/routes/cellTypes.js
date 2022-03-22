/* eslint-disable no-unused-vars */

const express = require('express')
const { fetchCellTypes, fetchCellTypesById } = require('../queries')
const { MissingParameter, NotFound } = require('../errors')

/**
 * @swagger
 *  components:
 *    schemas:
 *      CellType:
 *        type: object
 *        required:
 *          - id
 *          - name
 *          - description
 *        properties:
 *          id:
 *            type: string
 *          name:
 *            type: string
 *          parent_id:
 *            type: string
 *          description:
 *            type: string
 */

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  /**
   * @swagger
   *  /api/cell-types:
   *    get:
   *      description: Returns information about types of cells sequenced in this study
   *      tags:
   *        - Cell Types
   *      produces:
   *        - application/json
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/CellType'
   */
  app.get('/api/cell-types', async (_, res, next) => {
    const data = await fetchCellTypes().catch(next)
    res.status(200).json(data)
  })

  /**
   * @swagger
   *  /api/cell-types/{id}:
   *    get:
   *      description: Returns information about specific cell type sequenced in this study
   *      tags:
   *        - Cell Types
   *      produces:
   *        - application/json
   *      parameters:
   *        - in: path
   *          name: id
   *          required: true
   *          description: Shorthand cell type identifier
   *          schema:
   *            type: string
   *          example: bmem
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/CellType'
   *        404:
   *          description: The requested cell type does not exist
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   *
   */
  app.get('/api/cell-types/:id', async (req, res, next) => {
    const data = await fetchCellTypesById({ ids: [req.params.id] }).catch(next)

    if (!data || !data[0]) {
      next(new NotFound(`An entry matching cell type id '${req.params.id}' does not exist`))
    }

    res.status(200).json(data[0])
  })
}

module.exports = { setup }
