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
      keyFile:
        process.env.GOOGLE_APPLICATION_CREDENTIALS != null
          ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
          : undefined,
    })
    this.bucket = this.storage.bucket(this.rootDirectory.replace('gs://', '').split('/')[0])
    this.browserDataPath = path.join(...this.rootDirectory.replace('gs://', '').split('/').slice(1))
  }

  resolveFile(fileName, options = { subdirectories: [] }) {
    const pathInBucket = path.join(this.browserDataPath, ...options.subdirectories, fileName)

    if (this.fileCache.has(pathInBucket)) {
      return new Promise((resolve) => {
        resolve(this.fileCache.get(pathInBucket))
      })
    }

    const tempPath = path.resolve(path.join(this.tempDir, fileName))
    return this.bucket
      .file(pathInBucket)
      .download({ destination: tempPath })
      .then(() => {
        this.fileCache.set(pathInBucket, tempPath)
        return tempPath
      })
  }
}

module.exports = { GoogleBucketDataStore }
