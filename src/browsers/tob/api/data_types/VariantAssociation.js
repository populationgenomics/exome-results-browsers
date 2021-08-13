export class VariantAssociation {
  constructor({ snp, pval, chrom, pos, geneSymbol, geneId, cell, color }) {
    this.snp = (snp || '').toString().trim()
    this.chrom = (chrom || '').toString().trim()
    this.pval = parseFloat(pval)
    this.pos = parseInt(pos, 10)

    this.color = (color || '').toString().trim() || '#1c1c1c'
    this.geneSymbol = (geneSymbol || '').toString().trim()
    this.geneId = (geneId || '').toString().trim()
    this.cell = (cell || '').toString().trim()

    if (!this.snp) {
      throw new Error('Locus plot data point must define a snp identifier')
    }
    if (!this.chrom) {
      throw new Error('Locus plot data point must define a chromosome')
    }

    if (!this.pval && this.pval !== 0) {
      throw new Error('Locus plot data point must define a p-value')
    }
    if (!this.pos && this.pos !== 0) {
      throw new Error('Locus plot data point must define a position')
    }
  }
}

export default VariantAssociation
