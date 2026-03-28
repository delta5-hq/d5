import {ServerLifecycle} from '../../bootstrap/ServerLifecycle'

describe('ServerLifecycle', () => {
  let mockEnvironmentValidator
  let mockDatabaseConnector
  let lifecycle

  beforeEach(() => {
    mockEnvironmentValidator = {
      validate: jest.fn(),
    }
    mockDatabaseConnector = {
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
    }
    lifecycle = new ServerLifecycle(mockEnvironmentValidator, mockDatabaseConnector)
  })

  describe('startup', () => {
    it('validates environment before connecting to database', async () => {
      const callOrder = []
      mockEnvironmentValidator.validate.mockImplementation(() => callOrder.push('validate'))
      mockDatabaseConnector.connect.mockImplementation(() => {
        callOrder.push('connect')
        return Promise.resolve()
      })

      await lifecycle.startup()

      expect(callOrder).toEqual(['validate', 'connect'])
    })

    it('propagates environment validation errors without connecting to database', async () => {
      mockEnvironmentValidator.validate.mockImplementation(() => {
        throw new Error('D5_USER_ID missing')
      })

      await expect(lifecycle.startup()).rejects.toThrow('D5_USER_ID missing')
      expect(mockDatabaseConnector.connect).not.toHaveBeenCalled()
    })

    it('propagates database connection errors after validation', async () => {
      mockDatabaseConnector.connect.mockRejectedValue(new Error('MongoDB unreachable'))

      await expect(lifecycle.startup()).rejects.toThrow('MongoDB unreachable')
      expect(mockEnvironmentValidator.validate).toHaveBeenCalled()
    })

    it('can be called multiple times', async () => {
      await lifecycle.startup()
      await lifecycle.startup()

      expect(mockEnvironmentValidator.validate).toHaveBeenCalledTimes(2)
      expect(mockDatabaseConnector.connect).toHaveBeenCalledTimes(2)
    })
  })

  describe('shutdown', () => {
    it('disconnects from database', async () => {
      await lifecycle.shutdown()

      expect(mockDatabaseConnector.disconnect).toHaveBeenCalledTimes(1)
    })

    it('is idempotent — second call is no-op', async () => {
      await lifecycle.shutdown()
      await lifecycle.shutdown()

      expect(mockDatabaseConnector.disconnect).toHaveBeenCalledTimes(1)
    })

    it('propagates database disconnect errors on first call', async () => {
      mockDatabaseConnector.disconnect.mockRejectedValue(new Error('Disconnect failed'))

      await expect(lifecycle.shutdown()).rejects.toThrow('Disconnect failed')
    })

    it('does not throw on second call after error', async () => {
      mockDatabaseConnector.disconnect.mockRejectedValue(new Error('Disconnect failed'))

      await expect(lifecycle.shutdown()).rejects.toThrow('Disconnect failed')
      await expect(lifecycle.shutdown()).resolves.toBeUndefined()

      expect(mockDatabaseConnector.disconnect).toHaveBeenCalledTimes(1)
    })

    it('can be called without prior startup', async () => {
      await lifecycle.shutdown()

      expect(mockDatabaseConnector.disconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('registerExitHandlers', () => {
    let originalProcessOn
    let originalProcessExit
    let registeredHandlers

    beforeEach(() => {
      originalProcessOn = process.on
      originalProcessExit = process.exit
      registeredHandlers = {}
      process.on = jest.fn((event, handler) => {
        registeredHandlers[event] = handler
      })
      process.exit = jest.fn()
    })

    afterEach(() => {
      process.on = originalProcessOn
      process.exit = originalProcessExit
    })

    it('registers handlers for SIGINT, SIGUSR1, SIGUSR2, SIGTERM', () => {
      lifecycle.registerExitHandlers()

      expect(registeredHandlers.SIGINT).toBeDefined()
      expect(registeredHandlers.SIGUSR1).toBeDefined()
      expect(registeredHandlers.SIGUSR2).toBeDefined()
      expect(registeredHandlers.SIGTERM).toBeDefined()
    })

    it('registers uncaughtException handler', () => {
      lifecycle.registerExitHandlers()

      expect(registeredHandlers.uncaughtException).toBeDefined()
    })

    it('signal handlers call shutdown', async () => {
      lifecycle.registerExitHandlers()
      const shutdownSpy = jest.spyOn(lifecycle, 'shutdown').mockResolvedValue()

      await registeredHandlers.SIGINT()

      expect(shutdownSpy).toHaveBeenCalled()
    })

    it('signal handlers call process.exit(0)', async () => {
      lifecycle.registerExitHandlers()
      jest.spyOn(lifecycle, 'shutdown').mockResolvedValue()

      await registeredHandlers.SIGINT()

      expect(process.exit).toHaveBeenCalledWith(0)
    })

    it('uncaughtException handler calls shutdown', async () => {
      lifecycle.registerExitHandlers()
      const shutdownSpy = jest.spyOn(lifecycle, 'shutdown').mockResolvedValue()

      await registeredHandlers.uncaughtException(new Error('test error'))

      expect(shutdownSpy).toHaveBeenCalled()
    })

    it('uncaughtException handler calls process.exit(1)', async () => {
      lifecycle.registerExitHandlers()
      jest.spyOn(lifecycle, 'shutdown').mockResolvedValue()

      await registeredHandlers.uncaughtException(new Error('test error'))

      expect(process.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('lifecycle sequence', () => {
    it('supports startup → shutdown sequence', async () => {
      await lifecycle.startup()
      await lifecycle.shutdown()

      expect(mockEnvironmentValidator.validate).toHaveBeenCalledTimes(1)
      expect(mockDatabaseConnector.connect).toHaveBeenCalledTimes(1)
      expect(mockDatabaseConnector.disconnect).toHaveBeenCalledTimes(1)
    })

    it('supports startup → shutdown → startup sequence', async () => {
      await lifecycle.startup()
      await lifecycle.shutdown()

      lifecycle.shuttingDown = false

      await lifecycle.startup()

      expect(mockEnvironmentValidator.validate).toHaveBeenCalledTimes(2)
      expect(mockDatabaseConnector.connect).toHaveBeenCalledTimes(2)
      expect(mockDatabaseConnector.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})
