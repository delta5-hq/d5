/**
 * Echo HTTP Server Test Stub
 *
 * Minimal HTTP server that echoes back request body as JSON.
 * Used for integration testing of HTTPExecutor without external dependencies.
 *
 * Exports startEchoServer() which returns {server, port, url, close()}.
 * Uses port 0 for OS-assigned port to avoid conflicts in parallel test runs.
 */

const http = require('http')

/**
 * Starts an echo HTTP server on a random available port.
 *
 * @returns {Promise<{server: http.Server, port: number, url: string, close: () => Promise<void>}>}
 */
function startEchoServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = ''

      req.on('data', chunk => {
        body += chunk.toString()
      })

      req.on('end', () => {
        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(
          JSON.stringify({
            echoed: body,
            method: req.method,
            url: req.url,
          }),
        )
      })

      req.on('error', error => {
        res.writeHead(500, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({error: error.message}))
      })
    })

    server.on('error', reject)

    server.listen(0, () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to get server port'))
        return
      }

      const port = address.port
      const url = `http://localhost:${port}`

      resolve({
        server,
        port,
        url,
        close: () =>
          new Promise(resolveClose => {
            server.close(() => resolveClose())
          }),
      })
    })
  })
}

module.exports = {startEchoServer}
