/* eslint-disable no-unused-vars */

const express = require('express')
const process = require('process')

const information = require('./information')
const variants = require('./varirants')
const associations = require('./associations')
const cellTypes = require('./cellTypes')
const genes = require('./genes')
const errors = require('./errors')
const old = require('./old')

/**
 * @param {express.Express} app
 * @param {object} config
 */
const setup = (app, config) => {
  information.setup(app)

  if (process.env.ENABLE_NEW_API.toLowerCase() === 'true') {
    variants.setup(app)
    associations.setup(app)
    cellTypes.setup(app)
    genes.setup(app)
  } else {
    old.setup(app, config)
  }

  errors.setup(app)
}

module.exports = { setup }
