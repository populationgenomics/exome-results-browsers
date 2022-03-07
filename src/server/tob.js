const path = require('path')
const process = require('process')

const compression = require('compression')
const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')

const { OAuth2Client } = require('google-auth-library')

const {
  isRegionId,
  isVariantId,
  isRsId,
  parseRegionId,
  parseVariantId,
} = require('@gnomad/identifiers')

const {
  fetchGenes,
  fetchGenesAssociatedWithVariant,
  fetchGenesById,
  fetchGeneIdSuggestions,
  fetchAssociationHeatmap,
  fetchVariantsInRegion,
  fetchVariantsById,
  fetchCellTypes,
  fetchCellTypesById,
  fetchGenesInRegion,
  fetchGeneExpression,
} = require('./queries')
const { parseConditioningRound } = require('./queries/utilities')
const { convertPositionToGlobalPosition } = require('./queries/genome')
const { isGene, isEnsemblGeneId } = require('./identifiers')

// ================================================================================================
// Configuration
// ================================================================================================

const isDevelopment = process.env.NODE_ENV === 'development'

const config = {
  enableHttpsRedirect: JSON.parse(process.env.ENABLE_HTTPS_REDIRECT || 'false'),
  port: process.env.PORT || 8000,
  trustProxy: JSON.parse(process.env.TRUST_PROXY || 'false'),
  iapAudience: process.env.IAP_AUDIENCE,
  oAuthClient: new OAuth2Client(),
  maxRegionSize: process.env.MAX_REGION || 2.5e6,
}

// ================================================================================================
// Express app
// ================================================================================================

const app = express()

app.set('trust proxy', config.trustProxy)

app.use(compression())
app.use(helmet())

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
// JWT Token Verification
// ================================================================================================

if (config.iapAudience) {
  // Verify JWT token from IAP authentication
  app.use('/', async (req, res, next) => {
    const token = req.header('X-Goog-IAP-JWT-Assertion') || req.header('x-goog-iap-jwt-assertion')

    if (!token) return next()

    try {
      // Verify the id_token, and access the claims.
      const response = await config.oAuthClient.getIapPublicKeysAsync()
      const ticket = await config.oAuthClient.verifySignedJwtWithCertsAsync(
        token.toString(),
        response.pubkeys,
        config.iapAudience,
        ['https://cloud.google.com/iap']
      )

      // eslint-disable-next-line no-console
      console.debug(`${ticket.getPayload().email} has logged in.`)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      res.status(403).send('<h1>Forbidden</h1><p>Unable to verify authentication token.</p>').end()
    }

    return next()
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

  return fetchGeneIdSuggestions({ query: req.query.q }).then((data) =>
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

app.get('/api/genes', (req, res) => {
  const { query } = req.query

  if (isRegionId(query)) {
    const region = parseRegionId(query)

    if (Math.abs(region.stop - region.start) > config.maxRegionSize) {
      return res.status(400).json({ error: 'Data is not available for a region this large' })
    }

    return fetchGenesInRegion({ region })
      .then((results) => res.status(200).json({ results: { genes: results, region } }))
      .catch((error) => res.status(400).json({ error: error.message }))
  }

  if (isEnsemblGeneId(query)) {
    return fetchGenesById({ ids: [query] })
      .then((results) =>
        res.status(200).json({
          results: {
            genes: results,
            region: {
              chrom: results[0].chrom,
              start: results[0].global_start,
              stop: results[0].global_stop,
            },
          },
        })
      )
      .catch((error) => res.status(400).json({ error: error.message }))
  }

  if (isVariantId(query)) {
    const variant = parseVariantId(query)
    return fetchGenesAssociatedWithVariant({ variant })
      .then((results) =>
        res.status(200).json({
          results: {
            genes: results,
            region: {
              chrom: variant.chrom,
              start: Math.min(...results.map((r) => r.start)),
              stop: Math.max(...results.map((r) => r.stop)),
            },
          },
        })
      )
      .catch((error) => res.status(400).json({ error: error.message }))
  }

  return fetchGenes({ query })
    .then((results) =>
      res.status(200).json({
        results: {
          genes: results,
          region: null,
        },
      })
    )
    .catch((error) => res.status(400).json({ error: error.message }))
})

app.get('/api/genes/:id', (req, res) => {
  return fetchGenesById({ ids: [req.params.id] })
    .then((results) => res.status(200).json({ results: results[0] }))
    .catch((error) => res.status(400).json({ error: error.message }))
})

app.get('/api/genes/:gene/residuals', (req, res) => {
  return fetchGeneExpression({
    gene: req.params.gene,
    cellTypesIds: req.query.cellTypeIds?.split(',') || [],
    chroms: req.query.chroms?.split(',') || [],
  })
    .then((results) => res.status(200).json({ results }))
    .catch((error) => res.status(400).json({ error: error.message }))
})

// ================================================================================================
// Variants
// ===============================================================================================
app.get('/api/associations/', (req, res) => {
  let round = 1
  try {
    round = parseConditioningRound(req.query.round)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  const region = convertPositionToGlobalPosition({ ...parseRegionId(req.query.region) })
  const genes = req.query.genes?.trim()?.split(',') || []
  const cellTypes = req.query.cellTypes?.trim()?.split(',') || []

  if (Math.abs(region.stop - region.start) > config.maxRegionSize) {
    return res.status(400).json({ error: 'Data is not available for a region this large' })
  }

  return fetchVariantsInRegion({ region, genes, cellTypes, round })
    .then((results) => res.status(200).json({ results }))
    .catch((error) => res.status(400).json({ error: error.message }))
})

app.get('/api/associations/aggregate', (req, res) => {
  const { query } = req.query

  if (!(isRegionId(query) || isVariantId(query) || isRsId(query) || isGene(query))) {
    return res.status(400).json({ error: 'Query must be a gene, region, variant ID or rsid' })
  }

  if (isRegionId(query)) {
    const region = parseRegionId(query)

    if (Math.abs(region.stop - region.start) > config.maxRegionSize) {
      return res.status(400).json({ error: 'Data is not available for a region this large' })
    }
  }

  let round = 1
  try {
    round = parseConditioningRound(req.query.round)
  } catch (error) {
    return res.status(400).json({ error: error.message })
  }

  return fetchAssociationHeatmap({ query, round, aggregateBy: 'p_value' })
    .then((data) => res.status(200).json({ results: data }))
    .catch((error) => res.status(400).json({ error: error.message }))
})

app.get('/api/associations/:id', (req, res) => {
  return fetchVariantsById({ ids: [req.params.id] })
    .then((results) => res.status(200).json({ results }))
    .catch((error) => res.status(400).json({ error: error.message }))
})

// ================================================================================================
// Cell types
// ================================================================================================
app.get('/api/cell-types/', (req, res) => {
  return fetchCellTypes()
    .then((results) => res.status(200).json({ results }))
    .catch((error) => res.status(400).json({ error: error.message }))
})

app.get('/api/cell-types/:id', (req, res) => {
  return fetchCellTypesById({ ids: [req.params.id] })
    .then((results) => res.status(200).json({ results }))
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
