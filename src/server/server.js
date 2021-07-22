const fs = require('fs')
const path = require('path')
const process = require('process')
const readline = require('readline')

const compression = require('compression')
const express = require('express')
const morgan = require('morgan')

const { UMAP } = require('umap-js')
const dfd = require('danfojs-node')

const { PrefixTrie } = require('./search')
const { createDataStore } = require('./storage')

// ================================================================================================
// Configuration
// ================================================================================================

const isDevelopment = process.env.NODE_ENV === 'development'

const requiredConfig = ['RESULTS_DATA_DIRECTORY']
if (isDevelopment) {
  requiredConfig.push('BROWSER')
}
const missingConfig = requiredConfig.filter((option) => !process.env[option])
if (missingConfig.length) {
  throw Error(`Missing required environment variables: ${missingConfig.join(', ')}`)
}

const config = {
  enableHttpsRedirect: JSON.parse(process.env.ENABLE_HTTPS_REDIRECT || 'false'),
  port: process.env.PORT || 8000,
  trustProxy: JSON.parse(process.env.TRUST_PROXY || 'false'),
}

const dataStore = createDataStore({ rootDirectory: process.env.RESULTS_DATA_DIRECTORY })

// ================================================================================================
// Express app
// ================================================================================================

const app = express()
app.set('trust proxy', config.trustProxy)

app.use(compression())

// ================================================================================================
// Kubernetes readiness probe
// ================================================================================================

// This must be registered before the HTTP => HTTPS redirect because it must return 200, not 30x.
app.use('/ready', (request, response) => {
  response.send('true')
})

// ================================================================================================
// Logging
// ================================================================================================

app.use(morgan(isDevelopment ? 'dev' : 'combined'))

// ================================================================================================
// HTTP => HTTPS redirect
// ================================================================================================

if (config.enableHttpsRedirect) {
  app.use('/', (req, res, next) => {
    if (req.protocol === 'http') {
      res.redirect(`https://${req.get('host')}${req.url}`)
    } else {
      next()
    }
  })
}

// ================================================================================================
// Gene search
// ================================================================================================

const geneSearch = new PrefixTrie()

const indexGenes = () => {
  return new Promise((resolve) => {
    dataStore
      .resolveGeneSearchTermsFile()
      .then((filePath) => {
        const rl = readline.createInterface({
          input: fs.createReadStream(filePath),
          crlfDelay: Infinity,
        })

        rl.on('line', (line) => {
          const [geneId, searchTerms] = JSON.parse(line)
          for (const searchTerm of searchTerms) {
            geneSearch.add(searchTerm, geneId)
          }
        })

        rl.on('close', resolve)
      })
      .catch((error) => resolve(error))
  })
}

app.use('/api/search', (req, res) => {
  if (!req.query.q) {
    return res.status(400).json({ error: 'Query required' })
  }

  if (Array.isArray(req.query.q)) {
    return res.status(400).json({ error: 'One query required' })
  }

  let query = req.query.q
  // Upper case queries matching HGNC names or Ensembl identifiers
  if (req.query.q.match(/^[A-Z0-9-]+$|^C[0-9XY]+orf[0-9]+$/)) {
    query = req.query.q.toUpperCase()
  } else if (req.query.q.match(/^ENSG\d{11}$/)) {
    query = req.query.q.toUpperCase()
  }

  let results
  if (query.match(/^ENSG\d{11}$/)) {
    results = [{ label: query, url: `/gene/${query}` }]
  } else {
    results = geneSearch
      .search(query)
      .flatMap(({ word, docs: geneIds }) => {
        if (geneIds.length > 1) {
          return geneIds.map((geneId) => ({
            label: `${word} (${geneId})`,
            url: `/gene/${geneId}`,
          }))
        }

        return [
          {
            label: word,
            url: `/gene/${geneIds[0]}`,
          },
        ]
      })
      .slice(0, 5)
  }

  return res.json({ results })
})

// ================================================================================================
// Dataset
// ================================================================================================

let getDatasetForRequest = () => null
let metadata = {}
dataStore.resolveMetadataFile().then((filePath) => {
  metadata = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }))
  // In development, serve the browser specified by the BROWSER environment variable.
  // In production, determine the browser/dataset to show based on the subdomain.
  if (isDevelopment || process.env.BYPASS_SUBDOMAIN === 'true') {
    const devDataset = Object.keys(metadata.datasets).find(
      (dataset) => dataset.toLowerCase() === process.env.BROWSER.toLowerCase()
    )
    getDatasetForRequest = () => devDataset
  } else {
    const datasetBySubdomain = Object.keys(metadata.datasets).reduce(
      (acc, dataset) => ({
        ...acc,
        [dataset.toLowerCase()]: dataset,
      }),
      {}
    )
    getDatasetForRequest = (req) => datasetBySubdomain[req.subdomains[0]]
  }
})

// Store dataset on request object so other route handlers can use it.
app.use('/', (req, res, next) => {
  let dataset
  console.log(getDatasetForRequest(req))
  try {
    dataset = getDatasetForRequest(req)
  } catch (err) {} // eslint-disable-line no-empty

  if (!dataset) {
    res.status(500).json({ message: 'Unknown dataset' })
  } else {
    req.dataset = dataset
    next()
  }
})

const datasetConfig = {}
const getDatasetConfigJs = (dataset) => {
  if (!datasetConfig[dataset]) {
    const datasetMetadata = {
      datasetId: dataset,
      ...metadata,
      ...metadata.datasets[dataset],
    }
    datasetConfig[dataset] = `window.datasetConfig = ${JSON.stringify(datasetMetadata)}`
  }
  return datasetConfig[dataset]
}

app.use('/config.js', (req, res) => {
  res.type('text/javascript').send(getDatasetConfigJs(req.dataset))
})

// ================================================================================================
// Gene results
// ================================================================================================

app.get('/api/results', (req, res) => {
  dataStore
    .resolveDatasetFile(req.dataset)
    .then((filePath) => {
      return res.sendFile(filePath, (err) => {
        if (err) {
          res.status(404).json({ error: 'Results not found' })
        }
      })
    })
    .catch((error) => {
      const code = error?.code || 500
      res.status(code).json({ error: error.toString() })
    })
})

// ================================================================================================
// Gene
// ================================================================================================

app.get('/api/gene/:geneIdOrName', (req, res) => {
  const { geneIdOrName } = req.params

  let geneId
  if (geneIdOrName.match(/^ENSGR?\d+/)) {
    geneId = geneIdOrName
  } else {
    const geneIds = geneSearch.get(geneIdOrName.toUpperCase())
    if (geneIds.length === 1) {
      geneId = geneIds[0] // eslint-disable-line prefer-destructuring
    } else if (geneIds.length === 0) {
      return res.status(404).json({ error: 'Gene not found' })
    } else {
      return res.status(400).json({ error: 'Gene symbol matches multiple genes' })
    }
  }

  const referenceGenome = metadata.datasets[req.dataset].reference_genome
  dataStore
    .resolveGeneFile(geneId, referenceGenome)
    .then((filePath) => {
      return res.sendFile(filePath, (err) => {
        if (err) {
          res.status(404).json({ error: 'Gene not found' })
        }
      })
    })
    .catch((error) => {
      const code = error?.code || 500
      res.status(code).json({ error: error.toString() })
    })
})

// ================================================================================================
// Variants
// ================================================================================================

app.get('/api/gene/:geneIdOrName/variants', (req, res) => {
  const { geneIdOrName } = req.params

  let geneId
  if (geneIdOrName.match(/^ENSGR?\d+/)) {
    geneId = geneIdOrName
  } else {
    const geneIds = geneSearch.get(geneIdOrName.toUpperCase())
    if (geneIds.length === 1) {
      geneId = geneIds[0] // eslint-disable-line prefer-destructuring
    } else if (geneIds.length === 0) {
      return res.status(404).json({ error: 'Gene not found' })
    } else {
      return res.status(400).json({ error: 'Gene symbol matches multiple genes' })
    }
  }

  dataStore
    .resolveGeneVariantsFile(geneId, req.dataset)
    .then((filePath) => {
      return res.sendFile(filePath, (err) => {
        if (err) {
          res.status(404).json({ error: 'Gene not found' })
        }
      })
    })
    .catch((error) => {
      const code = error?.code || 500
      res.status(code).json({ error: error.toString() })
    })
})

// ================================================================================================
// UMAP computation
// ================================================================================================

app.get('/api/umap', (req, res) => {
  const {
    nNeighbors = 15,
    minDistance = 0.1,
    geneSymbols = null,
    cellLabels = null,
    nEpochs = 200,
  } = req.query

  // TODO: get these from config
  const GENES = [
    'AC000068.5',
    'AC002472.13',
    'AC007308.6',
    'ADORA2A-AS1',
    'ADRBK2',
    'APOBEC3A',
    'APOBEC3B',
    'APOBEC3C',
    'APOBEC3G',
    'APOBEC3H',
    'APOL2',
    'APOL6',
    'ARFGAP3',
    'ARSA',
    'ARVCF',
    'ASPHD2',
    'BCR',
    'BIK',
    'C22orf34',
    'CBX6',
    'CDC42EP1',
    'CHCHD10',
    'CRYBB2',
    'CTA-29F11.1',
    'DDT',
    'FAM118A',
    'GGT1',
    'IGLL1',
    'LGALS2',
    'MIF',
    'NDUFA6',
    'SELM',
  ]

  const LABELS = [
    'BimmNaive',
    'Bmem',
    'CD4all',
    'CD8all',
    'CD8eff',
    'CD8unknown',
    'DC',
    'MonoC',
    'MonoNC',
    'NKact',
    'NKmat',
    'Plasma',
  ]

  const removeGeneSymbols = GENES.filter((g) => !geneSymbols.includes(g))
  const removeCellLabels = new Set(LABELS.filter((l) => !cellLabels.includes(l)))

  dataStore
    .resolveUmapDataFile()
    .then((filePath) => {
      dfd
        .read_csv(filePath)
        .then((df) => {
          const umap = new UMAP({
            nComponents: 2,
            nEpochs,
            nNeighbors,
            minDist: minDistance,
            random: Math.random,
          })

          let labels = df.loc({ columns: ['cell_label'] }).values.flat()

          // Filter data points related to cell labels that were requested
          const data = df
            .drop({ columns: ['cell_label', ...removeGeneSymbols] })
            .values.filter((_, idx) => !removeCellLabels.has(labels[idx]))

          // Filter labels to those that were requested
          labels = labels.filter((l) => !removeCellLabels.has(l))
          const uniqueLabels = new Set(labels)

          try {
            const embedding = umap.fit(data)
            res.status(200).json({
              results: {
                embedding,
                labels,
                nLabels: uniqueLabels.size,
              },
            })
          } catch (e) {
            res.status(500).json({ error: e.toString() })
          }
        })
        .catch((e) => {
          res.status(500).json({ error: e.toString() })
        })
    })
    .catch((error) => {
      const code = error?.code || 500
      res.status(code).json({ error: error.toString() })
    })
})

// ================================================================================================
// API error handling
// ================================================================================================

// Return 404 for unknown API paths.
app.use('/api', (request, response) => {
  response.status(404).json({ error: 'not found' })
})

// ================================================================================================
// Static files
// ================================================================================================

// Serve static files from the appropriate dataset's directory. Webpack creates browser directories
// using uppercase characters when in production mode.
app.use((req, res, next) => {
  req.url = `/${isDevelopment ? req.dataset : req.dataset.toUpperCase()}${req.url}`
  next()
}, express.static(path.join(__dirname, 'public')))

// Return index.html for unknown paths and let client side routing handle it.
app.use((req, res) => {
  res.sendFile(
    path.resolve(
      __dirname,
      'public',
      isDevelopment ? req.dataset : req.dataset.toUpperCase(),
      'index.html'
    )
  )
})

// ================================================================================================
// Start
// ================================================================================================

indexGenes().then(() => {
  const server = app.listen(config.port)

  const shutdown = () => {
    server.close((err) => {
      if (err) {
        process.exitCode = 1
      }
      process.exit()
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})
