/* eslint-disable no-unused-vars */

const { ExpressionOptions } = require('./options')

const fetchAssociations = async (query, { limit = 25, config = {} } = {}) => {}
const fetchAssociationById = async (id, { config = {} } = {}) => {}
const fetchAssociationEffect = async (
  id,
  { type = ExpressionOptions.choices.log_cpm, config = {} } = {}
) => {}

module.exports = {
  fetchAssociations,
  fetchAssociationById,
  fetchAssociationEffect,
}
