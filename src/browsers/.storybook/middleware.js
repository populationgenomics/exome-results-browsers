const proxy = require('http-proxy-middleware')

module.exports = function expressMiddleware(router) {
  router.use(
    '/api',
    proxy({
      target: 'http://localhost:8000',
      changeOrigin: true,
    })
  )
}
