const fs = require('fs')
const path = require('path')
const process = require('process')
const readline = require('readline')

const compression = require('compression')
const express = require('express')
const morgan = require('morgan')

const { maxBy, minBy } = require('lodash')
const { UMAP } = require('umap-js')
const PapaParse = require('papaparse')
const {
  isRegionId,
  normalizeRegionId,
  parseRegionId,
  isVariantId,
  normalizeVariantId,
} = require('@gnomad/identifiers')

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
  if (isDevelopment) {
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
  try {
    dataset = getDatasetForRequest(req)
  } catch (err) {
    dataset = 'tob'
  } // eslint-disable-line no-empty

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
  return dataStore
    .resolveDatasetFile(req.dataset)
    .then((filePath) => {
      return res.sendFile(filePath, (err) => {
        if (err) {
          return res.status(404).json({ error: 'Results not found' })
        }
        return res
      })
    })
    .catch((error) => {
      const code = error?.code || 500
      return res.status(code).json({ error: error.toString() })
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
  return dataStore
    .resolveGeneFile(geneId, referenceGenome)
    .then((filePath) => {
      return res.sendFile(filePath, (err) => {
        if (err) {
          return res.status(404).json({ error: 'Gene not found' })
        }
        return res
      })
    })
    .catch((error) => {
      const code = error?.code || 500
      return res.status(code).json({ error: error.toString() })
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

  return dataStore
    .resolveGeneVariantsFile(geneId, req.dataset)
    .then((filePath) => {
      return res.sendFile(filePath, (err) => {
        if (err) {
          return res.status(404).json({ error: 'Gene not found' })
        }
        return res
      })
    })
    .catch((error) => {
      const code = error?.code || 500
      return res.status(code).json({ error: error.toString() })
    })
})

// ================================================================================================
// Associations
// ================================================================================================

const fetchGenesAssociatedWithVariant = (
  variant,
  { threshold, transform } = { threshold: null, transform: (x) => -Math.log10(x) }
) => {
  return dataStore.resolveGeneRecordsFile().then((file) => {
    const genes = JSON.parse(fs.readFileSync(file))

    return genes.filter((gene) => {
      return gene.associations
        .filter((v) => normalizeVariantId(v.id) === normalizeVariantId(variant))
        .filter((v) => (threshold == null ? true : transform(v.p_value) <= threshold))
    })
  })
}

const fetchGenesInRegion = (
  region,
  { threshold, transform } = { threshold: null, transform: (x) => -Math.log10(x) }
) => {
  const { chrom, start, stop } = region
  return dataStore.resolveGeneRecordsFile().then((file) => {
    const genes = JSON.parse(fs.readFileSync(file))

    return genes
      .filter((gene) => {
        return gene.chrom === chrom.toString() && start <= gene.start && gene.stop <= stop
      })
      .filter((gene) => {
        return gene.associations.filter((a) =>
          threshold == null ? true : transform(a.p_value) <= threshold
        )
      })
  })
}

const maxAssociationValue = ({ transform } = { transform: (x) => -Math.log10(x) }) => {
  return dataStore.resolveGeneRecordsFile().then((file) => {
    const genes = JSON.parse(fs.readFileSync(file))

    const values = genes
      .map((gene) => {
        return gene.associations.map((a) => transform(a.p_value))
      })
      .flat()

    return Math.max(...values)
  })
}

app.get('/api/associations', (req, res) => {
  const { search = null, threshold = null } = req.query
  const transform = (x) => -Math.log10(x)

  let promise = null
  try {
    if (isVariantId(search)) {
      const variant = normalizeVariantId(search)
      promise = fetchGenesAssociatedWithVariant(variant, { threshold, transform })
    } else if (isRegionId(search)) {
      const region = parseRegionId(normalizeRegionId(search))
      if (Math.abs(region.stop - region.start) > 4e6) {
        throw new Error('Region is too large, please restrict to 4Mb or less.')
      }
      promise = fetchGenesInRegion(region, { transform })
    } else {
      throw new Error(
        'Search supports either a region (eg 22:21077335-21080208) ' +
          'or a variant identifier (eg 22-21077335-A-G)'
      )
    }
  } catch (error) {
    return res.status(400).json({
      error: error.message,
    })
  }

  if (!promise) {
    return res.status(500).json({ error: 'A promise was broken' })
  }

  return promise
    .then((genes) => {
      if (!genes) {
        // TODO: Check empty genes client side and render an error message.
        return res.status(500).json({ error: `Search '${search}' returned no associations.` })
      }

      const geneNames = genes.map((g) => g.symbol)
      const cellNames = metadata.datasets[req.dataset].gene_group_result_field_names

      const heatmap = genes
        .map((gene) => {
          return cellNames.map((cell) => {
            return {
              gene: gene.symbol,
              cell,
              value: transform(
                maxBy(
                  gene.associations.filter((a) => a.cell === cell),
                  (d) => transform(d.p_value)
                )?.p_value || 1
              ),
            }
          })
        })
        .flat()

      const minValue = 0
      const maxValue = Math.ceil(maxBy(heatmap, (tile) => tile.value)?.value || 1) // maxAssociationValue({ transform })

      let region = {}
      const padding = 1e2
      if (isRegionId(search)) {
        region = { ...parseRegionId(normalizeRegionId(search)), feature_type: 'region' }
      } else {
        region = {
          start: minBy(genes, (g) => g.start).start,
          stop: maxBy(genes, (g) => g.stop).stop,
          chrom: genes.map((g) => g.chrom.toString())[0],
          feature_type: 'region',
        }
      }
      region.start -= padding
      region.stop += padding

      return res.status(200).json({
        results: {
          geneNames,
          cellNames,
          genes,
          regions: [region],
          heatmap,
          minValue,
          maxValue,
        },
      })
    })
    .catch((error) => {
      return res.status(500).json({
        error: error.message,
      })
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
    nEpochs = 100,
  } = req.query

  const allGenesSymbols = metadata.datasets[req.dataset].gene_symbols
  const allCellLabels = metadata.datasets[req.dataset].gene_group_result_field_names

  const removeGeneSymbols = new Set(allGenesSymbols.filter((g) => !geneSymbols.includes(g)))
  const removeCellLabels = new Set(allCellLabels.filter((l) => !cellLabels.includes(l)))

  return dataStore
    .resolveUmapDataFile()
    .then((filePath) => {
      PapaParse.parse(fs.readFileSync(filePath, 'utf8'), {
        header: true,
        delimiter: ',',
        error: (error) => {
          return res.status(500).json({ error: error.toString() })
        },
        complete: (results) => {
          const umap = new UMAP({
            nComponents: 2,
            nEpochs,
            nNeighbors,
            minDist: minDistance,
            random: Math.random,
          })

          // Filter data points related to cell labels that were requested
          let labels = results.data.map((row) => row.cell_label)
          const data = results.data
            .filter((row) => {
              return !removeCellLabels.has(row.cell_label)
            })
            .map((row) => {
              const rowData = []
              Object.entries(row).forEach(([key, value]) => {
                if (!removeGeneSymbols.has(key) && key !== 'cell_label') {
                  rowData.push(parseFloat(value))
                }
              })

              return rowData
            })

          // Filter labels to those that were requested
          labels = labels.filter((l) => !removeCellLabels.has(l))

          try {
            const embedding = umap.fit(data)
            return res.status(200).json({
              results: {
                data: embedding.map((e, i) => {
                  return { x: e[0], y: e[1], label: labels[i] }
                }),
              },
            })
          } catch (e) {
            return res.status(500).json({ error: e.toString() })
          }
        },
      })
    })
    .catch((error) => {
      const code = error?.code || 500
      return res.status(code).json({ error: error.toString() })
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
