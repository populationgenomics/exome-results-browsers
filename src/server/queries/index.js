const {
  fetchGenesInRegion,
  fetchGeneIdSuggestions,
  fetchGenesById,
  fetchGenes,
  fetchGeneExpression,
  fetchGenesAssociatedWithVariant,
} = require('./gene')
const { fetchVariantsInRegion, fetchVariantsById } = require('./variant')
const { fetchAssociationHeatmap } = require('./heatmap')
const { fetchCellTypes, fetchCellTypesById } = require('./cellType')

module.exports = {
  fetchGenesInRegion,
  fetchGeneIdSuggestions,
  fetchGenesById,
  fetchGenes,
  fetchGenesAssociatedWithVariant,
  fetchGeneExpression,
  fetchVariantsInRegion,
  fetchVariantsById,
  fetchAssociationHeatmap,
  fetchCellTypes,
  fetchCellTypesById,
}
