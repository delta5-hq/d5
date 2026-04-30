import {AbortSignalHandler} from './AbortSignalHandler'

describe('AbortSignalHandler', () => {
  let mockConnection
  let abortController

  beforeEach(() => {
    mockConnection = {
      cancel: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue(),
    }
    abortController = new AbortController()
  })

  describe('register and abort lifecycle', () => {
    it('calls cancel and close when signal aborts', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      handler.register()

      abortController.abort()
      await new Promise(resolve => setImmediate(resolve))

      expect(mockConnection.cancel).toHaveBeenCalled()
      expect(mockConnection.close).toHaveBeenCalled()
    })

    it('continues to close even if cancel fails', async () => {
      mockConnection.cancel.mockRejectedValue(new Error('Session ended'))
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      handler.register()

      abortController.abort()
      await new Promise(resolve => setImmediate(resolve))

      expect(mockConnection.cancel).toHaveBeenCalled()
      expect(mockConnection.close).toHaveBeenCalled()
    })

    it('prevents abort callback after unregister', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      handler.register()
      handler.unregister()

      abortController.abort()
      await new Promise(resolve => setImmediate(resolve))

      expect(mockConnection.cancel).not.toHaveBeenCalled()
      expect(mockConnection.close).not.toHaveBeenCalled()
    })

    it('does nothing when signal is null', () => {
      const handler = new AbortSignalHandler(null, mockConnection)
      handler.register()
      expect(() => handler.unregister()).not.toThrow()
    })

    it('does nothing when connection is null', () => {
      const handler = new AbortSignalHandler(abortController.signal, null)
      handler.register()
      expect(() => handler.unregister()).not.toThrow()
    })
  })

  describe('createAbortRace', () => {
    it('returns original promise when signal is null', async () => {
      const handler = new AbortSignalHandler(null, mockConnection)
      const promise = Promise.resolve('result')

      const result = await handler.createAbortRace(promise)

      expect(result).toBe('result')
    })

    it('resolves with promise result when not aborted', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      const promise = Promise.resolve('result')

      const result = await handler.createAbortRace(promise)

      expect(result).toBe('result')
    })

    it('rejects immediately if signal already aborted', async () => {
      abortController.abort()
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      const promise = new Promise(resolve => setTimeout(() => resolve('result'), 100))

      await expect(handler.createAbortRace(promise)).rejects.toThrow('Operation aborted')
    })

    it('rejects when signal aborts during promise execution', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      const promise = new Promise(resolve => setTimeout(() => resolve('result'), 100))

      const racePromise = handler.createAbortRace(promise)

      setTimeout(() => abortController.abort(), 10)

      await expect(racePromise).rejects.toThrow('Operation aborted')
    })

    it('handles rejected promise correctly', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      const promise = Promise.reject(new Error('Promise error'))

      await expect(handler.createAbortRace(promise)).rejects.toThrow('Promise error')
    })

    it('cleans up abort listener after promise resolves', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      const promise = Promise.resolve('result')

      await handler.createAbortRace(promise)

      abortController.abort()
      await new Promise(resolve => setImmediate(resolve))
    })

    it('cleans up abort listener after promise rejects', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      const promise = Promise.reject(new Error('Test error'))

      await expect(handler.createAbortRace(promise)).rejects.toThrow('Test error')

      abortController.abort()
      await new Promise(resolve => setImmediate(resolve))
    })

    it('cleans up abort listener when abort wins race', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      const promise = new Promise(resolve => setTimeout(() => resolve('slow'), 1000))

      const racePromise = handler.createAbortRace(promise)
      abortController.abort()

      await expect(racePromise).rejects.toThrow('Operation aborted')
    })

    it('handles multiple sequential races with same handler', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)

      const result1 = await handler.createAbortRace(Promise.resolve('first'))
      const result2 = await handler.createAbortRace(Promise.resolve('second'))

      expect(result1).toBe('first')
      expect(result2).toBe('second')
    })
  })

  describe('integration with ACPExecutor flow', () => {
    it('handles full lifecycle: register, abort during race, cleanup', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      handler.register()

      const promise = new Promise(resolve => setTimeout(() => resolve('result'), 100))
      const racePromise = handler.createAbortRace(promise)

      setTimeout(() => abortController.abort(), 10)

      await expect(racePromise).rejects.toThrow('Operation aborted')
      expect(mockConnection.cancel).toHaveBeenCalled()
      expect(mockConnection.close).toHaveBeenCalled()

      handler.unregister()
    })

    it('does not interfere with connection when signal never fires', async () => {
      const handler = new AbortSignalHandler(abortController.signal, mockConnection)
      handler.register()

      const promise = Promise.resolve('completed')
      const result = await handler.createAbortRace(promise)

      expect(result).toBe('completed')
      expect(mockConnection.cancel).not.toHaveBeenCalled()
      expect(mockConnection.close).not.toHaveBeenCalled()

      handler.unregister()
    })
  })
})
