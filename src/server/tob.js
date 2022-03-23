const path = require('path')
const process = require('process')

const compression = require('compression')
const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')
const bodyParser = require('body-parser')

const { OAuth2Client } = require('google-auth-library')

const routes = require('./routes')
const { config } = require('./config')
const { errorHandler } = require('./routes/errors')

// ================================================================================================
// Express app
// ================================================================================================

const app = express()

app.set('trust proxy', config.trustProxy)
app.use(compression())
app.use(helmet())
app.use(bodyParser.json())
app.use(morgan(config.isDevelopment ? 'dev' : 'combined'))

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
  const oAuthClient = new OAuth2Client()

  // Verify JWT token from IAP authentication
  app.use('/', async (req, res, next) => {
    const token = req.header('X-Goog-IAP-JWT-Assertion') || req.header('x-goog-iap-jwt-assertion')

    if (!token) return next()

    try {
      // Verify the id_token, and access the claims.
      const response = await oAuthClient.getIapPublicKeysAsync()
      const ticket = await oAuthClient.verifySignedJwtWithCertsAsync(
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
// Dataset
// ================================================================================================

// Store dataset on request object so other route handlers can use it.
app.use('/', (req, _, next) => {
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
// Setup API routing
// ================================================================================================

// Return index.html for React Swagger UI
app.get('/api', (req, res) => {
  res.sendFile(
    path.resolve(
      __dirname,
      'public',
      config.isDevelopment ? req.dataset : req.dataset.toUpperCase(),
      'index.html'
    )
  )
})

routes.setup(app, config)

// ================================================================================================
// Static files
// ================================================================================================
// Serve static files from the appropriate dataset's directory. Webpack creates browser directories
// using uppercase characters when in production mode.
app.use((req, _, next) => {
  req.url = `/${config.isDevelopment ? req.dataset : req.dataset.toUpperCase()}${req.url}`
  next()
}, express.static(path.join(__dirname, 'public')))

// Return index.html for unknown paths and let client side routing handle it.
app.use((req, res) => {
  res.sendFile(
    path.resolve(
      __dirname,
      'public',
      config.isDevelopment ? req.dataset : req.dataset.toUpperCase(),
      'index.html'
    )
  )
})

// ================================================================================================
// Error handling
// ================================================================================================
// Error middleware must be declared last.
app.use('/api', errorHandler)

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
