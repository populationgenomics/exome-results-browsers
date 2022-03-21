/* eslint-disable no-unused-vars */

const express = require('express')
const swaggerJsdoc = require('swagger-jsdoc')

const apiSpec = require('../api-spec.json')

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  /**
   * @swagger
   *  /api/health:
   *    get:
   *      description: Check if the API server is running and operational
   *      tags:
   *        - Information
   *      produces:
   *        - application/json
   *      responses:
   *        200:
   *          description: Witness the firepower of this fully ARMED and OPERATIONAL battle station!
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   *                properties:
   *                  message:
   *                    type: string
   *                    required: true
   *        500:
   *          description: It's a trap!
   *          content:
   *            application/json:
   *              schema:
   *                $ref: '#/components/schemas/Error'
   */
  app.get('/api/health', (_, res) => {
    return res.status(200).json({
      message: `
      Once upon a midnight dreary, while I pondered, weak and weary,
      Over many a quaint and curious volume of forgotten lore—
      While I nodded, nearly napping, suddenly there came a tapping,
      As of some one gently rapping, rapping at my chamber door.
      '’Tis some visitor,' I muttered, 'tapping at my chamber door—
      Only this and nothing more...'
      `.trim(),
    })
  })

  /**
   * @swagger
   *  /api/specification:
   *    get:
   *      description: Returns the OpenAPI specification
   *      tags:
   *        - Information
   *      produces:
   *        - application/json
   *      responses:
   *        200:
   *          content:
   *            application/json:
   *              schema:
   *                type: object
   */
  app.get('/api/specification', async (_, res) => {
    const options = {
      definition: { ...apiSpec },
      apis: [`${__dirname}/**/*.js`],
    }

    const openApiSpec = await swaggerJsdoc(options)
    return res.status(200).json(openApiSpec)
  })
}

module.exports = { setup }
