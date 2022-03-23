/* eslint-disable no-unused-vars */

const fetchVariants = async (query, { limit = 25, config = {} } = {}) => {}
const fetchVariantById = async (id, { config = {} } = {}) => {}
const fetchVariantAssociations = async (
  id,
  { cellTypeIds = [], rounds = [], fdr = 0.05, limit = 25, config = {} } = {}
) => {}
const fetchVariantAssociationAggregate = async (id, { config = {} } = {}) => {}

module.exports = {
  fetchVariants,
  fetchVariantById,
  fetchVariantAssociations,
  fetchVariantAssociationAggregate,
}
