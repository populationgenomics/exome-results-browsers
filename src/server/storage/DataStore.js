/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
const path = require('path')

class DataStore {
  constructor(rootDirectory) {
    this.rootDirectory = rootDirectory
  }

  /**
   * @returns {Promise<string>}
   */
  resolveGeneSearchTermsFile() {
    return this.resolveFile('gene_search_terms.txt.json')
  }

  /**
   * @returns {Promise<string>}
   */
  resolveMetadataFile() {
    return this.resolveFile('metadata.json')
  }

  /**
   * @param {string} dataset Dataset identifier included in request.
   *
   * @returns {Promise<string>}
   */
  resolveDatasetFile(dataset) {
    return this.resolveFile(`${dataset.toLowerCase()}.json`, { subdirectories: ['results'] })
  }

  /**
   * @returns {Promise<string>}
   */
  resolveUmapDataFile() {
    return this.resolveFile('cell_label_expression.csv', { subdirectories: ['results'] })
  }

  /**
   * @param {string} geneId Ensembl gene identifier.
   * @param {string} referenceGenome Reference genome name defined by the `reference_genome` field
   *  in the `metadata.json` file.
   *
   * @returns {Promise<string>}
   */
  resolveGeneFile(geneId, referenceGenome) {
    return this.resolveFile(`${geneId}_${referenceGenome}.json`, {
      subdirectories: this.geneDataDirectory(geneId),
    })
  }

  /**
   * @param {string} geneId Ensembl gene identifier.
   * @param {string} dataset Dataset identifier included in request.
   *
   * @returns {Promise<string>}
   */
  resolveGeneVariantsFile(geneId, dataset) {
    return this.resolveFile(`${geneId}_${dataset.toLowerCase()}_variants.json`, {
      subdirectories: this.geneDataDirectory(geneId),
    })
  }

  /**
   * Returns a promise resolving to the location of a file on local file system.
   *
   * @param {string} fileName
   * @param {{subdirectories: Array<string>}} options
   *
   * @returns {Promise<string>}
   */
  resolveFile(fileName, options = { subdirectories: [] }) {
    throw new Error('Method has not been implemented')
  }

  /**
   * Resolve the data directory for a specific gene
   *
   * @param {string} geneId Ensembl gene identifier.
   *
   * @returns {Array<string>}
   */
  geneDataDirectory(geneId) {
    const n = Number(geneId.replace(/^ENSGR?/, ''))

    return ['genes', String(n % 1000).padStart(3, '0')]
  }
}

module.exports = { DataStore }
