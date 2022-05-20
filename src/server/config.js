const process = require('process')

const config = {
  enableHttpsRedirect: JSON.parse(process.env.ENABLE_HTTPS_REDIRECT || 'false'),
  port: process.env.PORT || 8000,
  trustProxy: JSON.parse(process.env.TRUST_PROXY || 'false'),
  iapAudience: process.env.IAP_AUDIENCE,
  maxRegionSize: process.env.MAX_REGION || 2e6,
  isDevelopment: process.env.NODE_ENV === 'development',
  enableNewDatabase: process.env.DATASET_ID === 'test',
}

module.exports = { config }
