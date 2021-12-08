const {
  fetchGenesInRegion,
  fetchGeneIdSuggestions,
  fetchGenesById,
  fetchGenes,
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
  fetchVariantsInRegion,
  fetchVariantsById,
  fetchAssociationHeatmap,
  fetchCellTypes,
  fetchCellTypesById,
}
