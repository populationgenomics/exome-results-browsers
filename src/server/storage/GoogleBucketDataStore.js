/* eslint-disable prefer-destructuring */

const fs = require('fs')
const path = require('path')

const { Storage } = require('@google-cloud/storage')

const { DataStore } = require('./DataStore')

class GoogleBucketDataStore extends DataStore {
  constructor(rootDirectory) {
    super(rootDirectory)
    this.tempDir = fs.mkdtempSync('/tmp/tob_wgs_cache_')
    this.fileCache = new Map()
    this.storage = new Storage({
      projectId: 'tob-wgs-browser',
      keyFile: path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    })
    this.bucket = this.storage.bucket(this.rootDirectory.replace('gs://', '').split('/')[0])
    this.browserDataPath = path.join(...this.rootDirectory.replace('gs://', '').split('/').slice(1))
  }

  resolveFile(fileName, options = { subdirectories: [] }) {
    if (this.fileCache.has(fileName)) {
      return new Promise((resolve) => {
        resolve(this.fileCache.get(fileName))
      })
    }

    const tempPath = path.resolve(path.join(this.tempDir, fileName))
    return this.bucket
      .file(path.join(this.browserDataPath, ...options.subdirectories, fileName))
      .download({ destination: tempPath })
      .then(() => {
        this.fileCache.set(fileName, tempPath)
        return tempPath
      })
  }
}

module.exports = { GoogleBucketDataStore }
