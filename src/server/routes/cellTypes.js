const express = require('express')
const { fetchCellTypes, fetchCellTypesById } = require('../queries')

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
  app.get('/api/cell-types', async (_, res) => {
    try {
      const data = await fetchCellTypes()
      return res.status(200).json(data)
    } catch (e) {
      return res.status(500).json({ code: 500, error: 'ServerError', message: e.message })
    }
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
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/CellType'
   *        400:
   *          description: You have not provided a cell type id
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/cell-types/:id', async (req, res) => {
    try {
      if (!req.params.id) {
        return res.status(400).json({
          code: 400,
          type: 'MissingParameters',
          message: 'Please provide a cell type id to retrieve',
        })
      }

      console.log(req.params.id)
      const data = await fetchCellTypesById({ ids: [req.params.id] })
      return res.status(200).json(data[0] || null)
    } catch (e) {
      return res.status(500).json({ code: 500, error: 'ServerError', message: e.message })
    }
  })
}

module.exports = { setup }
