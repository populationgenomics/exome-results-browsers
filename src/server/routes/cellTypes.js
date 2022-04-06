/* eslint-disable no-unused-vars */

const express = require('express')

const { fetchCellTypes, fetchCellTypeById } = require('../queries/cellType')
const { NotFound } = require('../errors')

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
    return res.status(200).json(data)
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
    const data = await fetchCellTypeById(req.params.id).catch(next)
    if (!data) return next(new NotFound('Cell type not found'))
    return res.status(200).json(data)
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
 *      CellType:
 *        type: object
 *        required:
 *          - cell_type_id
 *          - cell_type_name
 *          - description
 *        properties:
 *          cell_type_id:
 *            type: string
 *          cell_type_name:
 *            type: string
 *          description:
 *            type: string
 */
