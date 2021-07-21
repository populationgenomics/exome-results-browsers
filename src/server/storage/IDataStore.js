/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
const path = require('path')

class IDataStore {
  constructor(rootDirectory) {
    this.rootDirectory = rootDirectory
  }

  /**
   * Returns the location of a file on local file system.
   *
   * @param {string} fileName
   * @param {string, null} subdirectory
   *
   * @returns {Promise<string>}
   */
  resolveFile(fileName, subdirectory = null) {
    throw new Error('Method has not been implemented')
  }
}

module.exports = { IDataStore }
