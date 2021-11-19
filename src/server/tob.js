const path = require('path')
const process = require('process')

const compression = require('compression')
const express = require('express')
const morgan = require('morgan')

const {
  isRegionId,
  normalizeRegionId,
  parseRegionId,
  isVariantId,
  normalizeVariantId,
  isRsId,
} = require('@gnomad/identifiers')

const {
  fetchGeneIdSuggestions,
  fetchAssociationHeatmap,
  convertPositionToGlobalPosition,
} = require('./api/bigQuery')

// ================================================================================================
// Configuration
// ================================================================================================

const isDevelopment = process.env.NODE_ENV === 'development'

const config = {
  enableHttpsRedirect: JSON.parse(process.env.ENABLE_HTTPS_REDIRECT || 'false'),
  port: process.env.PORT || 8000,
  trustProxy: JSON.parse(process.env.TRUST_PROXY || 'false'),
}

// ================================================================================================
// Express app
// ================================================================================================

const app = express()
app.set('trust proxy', config.trustProxy)

app.use(compression())

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

app.use('/api/search', (req, res) => {
  if (!req.query.q) {
    return res.status(400).json({ error: 'Query required' })
  }

  if (Array.isArray(req.query.q)) {
    return res.status(400).json({ error: 'One query required' })
  }

  return fetchGeneIdSuggestions({ gene: req.query.q }).then((data) =>
    res.status(200).json({ results: data })
  )
})

// ================================================================================================
// Dataset
// ================================================================================================

// Store dataset on request object so other route handlers can use it.
app.use('/', (req, res, next) => {
  req.dataset = 'tob'
  next()
})

const datasetConfig = {}
const getDatasetConfigJs = (dataset) => {
  if (!datasetConfig[dataset]) {
    const datasetMetadata = {
      datasetId: dataset,
    }
    datasetConfig[dataset] = `window.datasetConfig = ${JSON.stringify(datasetMetadata)}`
  }
  return datasetConfig[dataset]
}

app.use('/config.js', (req, res) => {
  res.type('text/javascript').send(getDatasetConfigJs(req.dataset))
})

// ================================================================================================
// Gene
// ================================================================================================

// ================================================================================================
// Variants
// ===============================================================================================

// ================================================================================================
// Association heatmap
// ================================================================================================

app.get('/api/heatmap', (req, res) => {
  if (!isRegionId(req.query.search)) {
    return res.status(400).json({ error: 'Query must be a region or variant ID' })
  }

  return fetchAssociationHeatmap({
    region: convertPositionToGlobalPosition({
      ...parseRegionId(req.query.search),
    }),
    round: req.query.round || 1,
    options: { verbose: true },
  })
    .then((data) => res.status(200).json({ results: data }))
    .catch((error) => res.status(400).json({ error: error.message }))
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
