const path = require('path')

const { IDataStore } = require('./IDataStore')

class LocalDiskDataStore extends IDataStore {
  fullPath(fileName, subdirectory = null) {
    if (subdirectory) {
      return path.join(this.rootDirectory, subdirectory, fileName)
    }
    return path.join(this.rootDirectory, fileName)
  }

  resolveFile(fileName, subdirectory = null) {
    return new Promise((resolve) => {
      resolve(path.resolve(this.getPath(fileName, subdirectory)))
    })
  }
}

module.exports = { LocalDiskDataStore }
