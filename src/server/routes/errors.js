/* eslint-disable no-unused-vars */

const express = require('express')

const { NotFound } = require('../errors')

/**
 * Express custom error handling middleware
 *
 * @param {Error} err
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {function} next
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  if (req.baseUrl.includes('/api') || req.accepts('json') || req.xhr) {
    return res.status(err.statusCode ?? 500).json({
      code: err.statusCode ?? 500,
      type: err.constructor.name,
      message: err.message,
    })
  }

  return next(err)
}

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
  app.use('/api', (req, _, next) => {
    next(new NotFound(`Resource '${req.baseUrl}${req.path}' could not be found`))
  })
}

module.exports = { setup, errorHandler }
