const { parseNumber } = require('../utils')

class ReferenceGenome {
  static GENOMES = {
    grch37: 'grch37',
    grch38: 'grch38',
  }

  static referenceGenomeIds() {
    return Array.from(Object.values(this.GENOMES))
  }

  static default() {
    return this.grch37()
  }

  static grch37() {
    return this.GENOMES.grch37
  }

  static grch38() {
    return this.GENOMES.grch38
  }

  static getFromEnv() {
    if (process.env.REFERENCE_GENOME) {
      return this.getReference(process.env.REFERENCE_GENOME)
    }
    return this.default()
  }

  static getReference(value) {
    const id = value.toString().toLowerCase()

    if (!this.referenceGenomeIds().includes(id)) {
      const options = this.referenceGenomeIds()
        .map((r) => `'${r}'`)
        .join(', ')

      throw new Error(`'${id}' is not a supported reference. Supported reference are ${options}`)
    }

    return id
  }
}

const CHROM_LENGTHS = {
  [ReferenceGenome.grch37()]: {
    chr1: 249250621,
    chr2: 243199373,
    chr3: 198022430,
    chr4: 191154276,
    chr5: 180915260,
    chr6: 171115067,
    chr7: 159138663,
    chr8: 146364022,
    chr9: 141213431,
    chr10: 135534747,
    chr11: 135006516,
    chr12: 133851895,
    chr13: 115169878,
    chr14: 107349540,
    chr15: 102531392,
    chr16: 90354753,
    chr17: 81195210,
    chr18: 78077248,
    chr19: 59128983,
    chr20: 63025520,
    chr21: 48129895,
    chr22: 51304566,
    chrX: 155270560,
    chrY: 59373566,
  },
  [ReferenceGenome.grch38()]: {
    chr1: 248956422,
    chr2: 242193529,
    chr3: 198295559,
    chr4: 190214555,
    chr5: 181538259,
    chr6: 170805979,
    chr7: 159345973,
    chr8: 145138636,
    chr9: 138394717,
    chr10: 133797422,
    chr11: 135086622,
    chr12: 133275309,
    chr13: 114364328,
    chr14: 107043718,
    chr15: 101991189,
    chr16: 90338345,
    chr17: 83257441,
    chr18: 80373285,
    chr19: 58617616,
    chr20: 64444167,
    chr21: 46709983,
    chr22: 50818468,
    chrX: 156040895,
    chrY: 57227415,
  },
}

const getChromOffsets = () => {
  const offsets = {
    [ReferenceGenome.grch37()]: {},
    [ReferenceGenome.grch38()]: {},
  }

  Object.keys(offsets).forEach((reference) => {
    Object.keys(CHROM_LENGTHS[reference]).forEach((_, index) => {
      const offset = Object.values(CHROM_LENGTHS[reference])
        .slice(0, index)
        .reduce((x, y) => x + y, 0)

      offsets[reference][index + 1] = offset
    })
  })

  return offsets
}

/**
 * @param {{chrom: string | number, start: number, stop: number, reference: string}}
 * @returns {{chrom: string | number, start: number, stop: number}}
 */
const convertPositionToGlobalPosition = ({
  chrom,
  start,
  stop,
  reference = ReferenceGenome.getFromEnv(),
}) => {
  if (!chrom) throw new Error('Range attribute `chrom` is required.')

  const refId = ReferenceGenome.getReference(reference)

  // Range end is not included
  const offset = getChromOffsets()[refId][parseNumber(chrom, null)] - 1

  if (offset == null) throw new Error(`Could not find offset for chromosome '${chrom}'`)

  return {
    chrom,
    start: Number.isInteger(start) ? start + offset : start,
    stop: Number.isInteger(stop) ? stop + offset : stop,
  }
}

module.exports = {
  ReferenceGenome,
  convertPositionToGlobalPosition,
}
