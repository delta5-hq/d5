import debug from 'debug'

export class ServerLifecycle {
  constructor(environmentValidator, databaseConnector, serverName = 'mcp-server') {
    this.environmentValidator = environmentValidator
    this.databaseConnector = databaseConnector
    this.serverName = serverName
    this.shuttingDown = false
    this.log = debug(`delta5:mcp:${serverName}:lifecycle`)
  }

  async startup() {
    this.log('Validating environment')
    this.environmentValidator.validate()

    if (this.databaseConnector) {
      this.log('Connecting to database')
      await this.databaseConnector.connect()
    }

    this.log('Startup complete')
  }

  async shutdown() {
    if (this.shuttingDown) return
    this.shuttingDown = true

    this.log('Shutting down')
    if (this.databaseConnector) {
      await this.databaseConnector.disconnect()
    }
    this.log('Shutdown complete')
  }

  registerExitHandlers() {
    const signalNames = ['SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM']

    signalNames.forEach(signal => {
      process.on(signal, async () => {
        this.log(`Received signal: ${signal}`)
        await this.shutdown()
        process.exit(0)
      })
    })

    process.on('uncaughtException', async error => {
      this.log('Uncaught exception:', error)
      await this.shutdown()
      process.exit(1)
    })
  }
}
