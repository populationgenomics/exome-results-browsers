const fetchVariants = async ({ query, limit, options }) = {}
const fetchVariantById = async ({ id, options }) = {}
const fetchVariantAssociations = async ({ id, limit, options }) = {}
const fetchVariantAssociationAggregate = async ({id, options}) = {}

module.exports = {
  fetchVariants,
  fetchVariantById,
  fetchVariantAssociations,
  fetchVariantAssociationAggregate
}