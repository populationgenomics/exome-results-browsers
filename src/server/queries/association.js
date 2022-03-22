const fetchAssociations = async ({ query, limit, options }) = {}
const fetchAssociationsById = async ({ id, options }) = {}
const fetchAssociationEffect = async ({ id, type, options }) = {}

module.exports = {
  fetchAssociations,
  fetchAssociationsById,
  fetchAssociationEffect,
}