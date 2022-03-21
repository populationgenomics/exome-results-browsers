const express = require('express')

/**
 * @swagger
 *  components:
 *    schemas:
 *      Error:
 *        type: object
 *        required:
 *          - code
 *          - type
 *          - message
 *        properties:
 *          code:
 *            type: integer
 *            format: int32
 *          type:
 *            type: string
 *          message:
 *            type: string
 */

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  // Return 404 for unknown API paths.
  app.use('/api', (req, res) => {
    res.status(404).json({
      code: 404,
      type: 'NotFound',
      message: `Resource '${req.baseUrl}${req.path}' could not be found`,
    })
  })
}

module.exports = { setup }
