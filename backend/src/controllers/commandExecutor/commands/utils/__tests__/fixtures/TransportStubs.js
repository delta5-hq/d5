import path from 'path'

const {startEchoServer} = require('../../../../../../test-stubs/echo-http-server.cjs')

export class TransportStubs {
  constructor() {
    this.echoMcpPath = path.resolve(__dirname, '../../../../../../test-stubs/echo-mcp-server.cjs')
    this.echoHttpServer = null
    this.echoAcpPath = path.resolve(__dirname, '../../../../../../test-stubs/echo-acp-server.cjs')
  }

  getMcpStdioPath() {
    return this.echoMcpPath
  }

  getAcpLocalPath() {
    return this.echoAcpPath
  }

  async startHttpServer() {
    if (this.echoHttpServer) return this.echoHttpServer.url
    this.echoHttpServer = await startEchoServer()
    return this.echoHttpServer.url
  }

  getHttpServerUrl() {
    if (!this.echoHttpServer) throw new Error('HTTP server not started')
    return this.echoHttpServer.url
  }

  async stopHttpServer() {
    if (!this.echoHttpServer) return
    await this.echoHttpServer.close()
    this.echoHttpServer = null
  }

  async cleanup() {
    await this.stopHttpServer()
  }
}
