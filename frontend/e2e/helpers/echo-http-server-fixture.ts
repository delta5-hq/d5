import * as http from 'node:http'
import * as net from 'node:net'

export interface EchoHttpServer {
  readonly port: number
  readonly url: string
  stop(): Promise<void>
}

export function startEchoHttpServer(): Promise<EchoHttpServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', chunk => {
        body += chunk.toString()
      })
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ echoed: body }))
      })
    })

    server.once('error', reject)

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo
      resolve({
        port,
        url: `http://127.0.0.1:${port}`,
        stop: () => new Promise<void>((res, rej) => server.close(err => (err ? rej(err) : res()))),
      })
    })
  })
}
