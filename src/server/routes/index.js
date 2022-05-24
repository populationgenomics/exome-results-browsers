/* eslint-disable no-unused-vars */

const express = require('express')

const information = require('./information')
const variants = require('./varirants')
const associations = require('./associations')
const cellTypes = require('./cellTypes')
const genes = require('./genes')
const errors = require('./errors')

/**
 * @param {express.Express} app
 */
const setup = (app) => {
  information.setup(app)
  variants.setup(app)
  associations.setup(app)
  cellTypes.setup(app)
  genes.setup(app)
  errors.setup(app)
}

module.exports = { setup }
