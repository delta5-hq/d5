import debug from 'debug'

const log = debug('delta5:mcp:research-rag:lifecycle')

export class ServerLifecycle {
  constructor(environmentValidator, databaseConnector) {
    this.environmentValidator = environmentValidator
    this.databaseConnector = databaseConnector
    this.shuttingDown = false
  }

  async startup() {
    log('Validating environment')
    this.environmentValidator.validate()

    log('Connecting to database')
    await this.databaseConnector.connect()

    log('Startup complete')
  }

  async shutdown() {
    if (this.shuttingDown) return
    this.shuttingDown = true

    log('Shutting down')
    await this.databaseConnector.disconnect()
    log('Shutdown complete')
  }

  registerExitHandlers() {
    const signalNames = ['SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGTERM']

    signalNames.forEach(signal => {
      process.on(signal, async () => {
        log(`Received signal: ${signal}`)
        await this.shutdown()
        process.exit(0)
      })
    })

    process.on('uncaughtException', async error => {
      log('Uncaught exception:', error)
      await this.shutdown()
      process.exit(1)
    })
  }
}
