const path = require('path')

const { GoogleBucketDataStore } = require('./GoogleBucketDataStore')
const { LocalDiskDataStore } = require('./LocalDiskDataStore')
// eslint-disable-next-line no-unused-vars
const { DataStore } = require('./DataStore')

/**
 * @param {{rootDirectory: string}} config
 *
 * @returns {DataStore}
 */
const createDataStore = ({ rootDirectory }) => {
  if (rootDirectory.includes('gs://')) {
    return new GoogleBucketDataStore(rootDirectory)
  }
  return new LocalDiskDataStore(path.resolve(rootDirectory))
}

module.exports = { createDataStore }
