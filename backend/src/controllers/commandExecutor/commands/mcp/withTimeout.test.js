import {withTimeout, TimeoutError} from './withTimeout'

describe('withTimeout', () => {
  describe('promise resolution races', () => {
    it.each([
      ['string', 'success'],
      ['number', 42],
      ['object', {data: 'value'}],
      ['array', [1, 2, 3]],
      ['null', null],
      ['undefined', undefined],
    ])('resolves with %s value when promise completes before timeout', async (_label, value) => {
      const fastPromise = Promise.resolve(value)
      const result = await withTimeout(fastPromise, 1000, 'test operation')
      expect(result).toBe(value)
    })

    it('rejects with original error when promise rejects before timeout', async () => {
      const failingPromise = Promise.reject(new Error('operation failed'))
      await expect(withTimeout(failingPromise, 1000, 'test operation')).rejects.toThrow('operation failed')
    })

    it('preserves original error type and properties when promise rejects before timeout', async () => {
      class CustomError extends Error {
        constructor(message, code) {
          super(message)
          this.code = code
        }
      }
      const customError = new CustomError('custom failure', 'ERR_CUSTOM')
      const failingPromise = Promise.reject(customError)

      try {
        await withTimeout(failingPromise, 1000, 'test operation')
      } catch (error) {
        expect(error).toBeInstanceOf(CustomError)
        expect(error.code).toBe('ERR_CUSTOM')
      }
    })
  })

  describe('timeout behavior', () => {
    it.each([
      ['very short timeout', 10],
      ['short timeout', 50],
      ['medium timeout', 100],
      ['long timeout', 500],
    ])('rejects with TimeoutError for %s when promise is slower', async (_label, timeoutMs) => {
      const slowPromise = new Promise(resolve => setTimeout(() => resolve('too late'), timeoutMs + 100))
      await expect(withTimeout(slowPromise, timeoutMs, 'slow operation')).rejects.toThrow(TimeoutError)
    })

    it('wins the race when promise resolves just before timeout', async () => {
      const almostTimeoutPromise = new Promise(resolve => setTimeout(() => resolve('just in time'), 40))
      const result = await withTimeout(almostTimeoutPromise, 50, 'close call')
      expect(result).toBe('just in time')
    })
  })

  describe('TimeoutError properties', () => {
    const createTimedOutPromise = timeoutMs =>
      new Promise(resolve => setTimeout(() => resolve('too late'), timeoutMs + 100))

    it.each([
      ['connect', 30000, 'connect timed out after 30000ms'],
      ['database query', 5000, 'database query timed out after 5000ms'],
      ['HTTP request', 10000, 'HTTP request timed out after 10000ms'],
    ])('includes operation name and duration in message: %s', async (operation, timeoutMs, expectedMessage) => {
      await expect(withTimeout(createTimedOutPromise(timeoutMs), timeoutMs, operation)).rejects.toThrow(expectedMessage)
    })

    it('includes timeoutMs property in TimeoutError instance', async () => {
      try {
        await withTimeout(createTimedOutPromise(50), 50, 'connect')
      } catch (error) {
        expect(error.timeoutMs).toBe(50)
      }
    })

    it('sets name property to TimeoutError', async () => {
      try {
        await withTimeout(createTimedOutPromise(50), 50, 'connect')
      } catch (error) {
        expect(error.name).toBe('TimeoutError')
      }
    })

    it('is an instance of Error', async () => {
      try {
        await withTimeout(createTimedOutPromise(50), 50, 'connect')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }
    })

    it('is an instance of TimeoutError', async () => {
      try {
        await withTimeout(createTimedOutPromise(50), 50, 'connect')
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError)
      }
    })
  })

  describe('edge cases', () => {
    it('handles zero timeout by immediately rejecting', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('value'), 10))
      await expect(withTimeout(promise, 0, 'zero timeout')).rejects.toThrow(TimeoutError)
    })

    it('handles already-resolved promise', async () => {
      const resolvedPromise = Promise.resolve('already done')
      const result = await withTimeout(resolvedPromise, 1000, 'instant')
      expect(result).toBe('already done')
    })

    it('handles already-rejected promise', async () => {
      const rejectedPromise = Promise.reject(new Error('already failed'))
      await expect(withTimeout(rejectedPromise, 1000, 'instant')).rejects.toThrow('already failed')
    })
  })

  describe('TimeoutError class', () => {
    it('can be instantiated directly', () => {
      const error = new TimeoutError('test message', 1000)
      expect(error.message).toBe('test message')
      expect(error.timeoutMs).toBe(1000)
      expect(error.name).toBe('TimeoutError')
    })

    it('is instanceof Error', () => {
      const error = new TimeoutError('test', 1000)
      expect(error).toBeInstanceOf(Error)
    })

    it('has correct prototype chain', () => {
      const error = new TimeoutError('test', 1000)
      expect(Object.getPrototypeOf(error)).toBe(TimeoutError.prototype)
      expect(Object.getPrototypeOf(TimeoutError.prototype)).toBe(Error.prototype)
    })
  })
})
