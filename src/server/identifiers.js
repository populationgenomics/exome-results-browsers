const isEnsemblGeneId = (value) => {
  if (!value?.toString()) return false
  return /^ENSG\d{11}$/i.test(value.toString())
}

const isGeneSymbol = (value) => {
  if (!value?.toString()) return false
  return /^[A-Z][A-Z0-9-]*$/i.test(value.toString())
}

const isGene = (value) => {
  return isEnsemblGeneId(value) || isGeneSymbol(value)
}

module.exports = { isEnsemblGeneId, isGeneSymbol, isGene }
