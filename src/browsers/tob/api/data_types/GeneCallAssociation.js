export class GeneCellAssociation {
  constructor({ gene, cell, pval }) {
    this.gene = (gene || '').toString().trim()
    this.cell = (cell || '').toString().trim()
    this.pval = parseFloat(pval)

    if (!this.gene) {
      throw new Error('Heatmap tile must define a gene name')
    }
    if (!this.cell) {
      throw new Error('Heatmap tile must define a cell name')
    }
    if (!this.pval && this.pval !== 0) {
      throw new Error('Heatmap tile must define a p-value')
    }
  }
}

export default GeneCellAssociation
