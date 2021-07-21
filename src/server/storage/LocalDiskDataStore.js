const path = require('path')

const { DataStore } = require('./DataStore')

class LocalDiskDataStore extends DataStore {
  resolveFile(fileName, options = { subdirectories: [] }) {
    return new Promise((resolve) => {
      resolve(path.resolve(path.join(this.rootDirectory, ...options.subdirectories, fileName)))
    })
  }
}

module.exports = { LocalDiskDataStore }
