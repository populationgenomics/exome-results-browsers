const { GoogleBucketDataStore } = require('./GoogleBucketDataStore')
const { LocalDiskDataStore } = require('./LocalDiskDataStore')

const createDataStore = (config) => {
  if (config.rootDirectory.include('gs://')) {
    return new GoogleBucketDataStore(config.rootDirectory)
  }
  return new LocalDiskDataStore(config.rootDirectory)
}

module.exports = { createDataStore }
