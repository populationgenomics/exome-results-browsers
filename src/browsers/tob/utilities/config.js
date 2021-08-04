import datasetConfig from '../../datasetConfig'

export const cellLabels = () => {
  return [...datasetConfig.gene_group_result_field_names]
}

export const geneSymbols = () => {
  return [...datasetConfig.gene_symbols]
}

export default {
  cellLabels,
  geneSymbols,
}
