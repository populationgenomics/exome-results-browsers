const path = require('path')

const { GoogleBucketDataStore } = require('./GoogleBucketDataStore')
const { LocalDiskDataStore } = require('./LocalDiskDataStore')
// eslint-disable-next-line no-unused-vars
const { IDataStore } = require('./IDataStore')

/**
 * @param {{rootDirectory: string}} config
 * @returns {IDataStore}
 */
const createDataStore = ({ rootDirectory }) => {
  if (rootDirectory.includes('gs://')) {
    return new GoogleBucketDataStore(rootDirectory)
  }
  return new LocalDiskDataStore(path.resolve(rootDirectory))
}

module.exports = { createDataStore }
