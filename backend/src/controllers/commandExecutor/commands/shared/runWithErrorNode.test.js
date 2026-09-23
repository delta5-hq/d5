import {runWithErrorNode} from './runWithErrorNode'

const makeStore = () => ({
  importer: {createErrorNode: jest.fn()},
})

const makeNode = id => ({id})

describe('runWithErrorNode', () => {
  let store
  let logError

  beforeEach(() => {
    store = makeStore()
    logError = jest.fn()
  })

  describe('success path', () => {
    it('returns the fn return value', async () => {
      const result = await runWithErrorNode(store, makeNode('n1'), logError, async () => 42)
      expect(result).toBe(42)
    })

    it('does not call createErrorNode', async () => {
      await runWithErrorNode(store, makeNode('n1'), logError, async () => 'ok')
      expect(store.importer.createErrorNode).not.toHaveBeenCalled()
    })

    it('does not call logError', async () => {
      await runWithErrorNode(store, makeNode('n1'), logError, async () => 'ok')
      expect(logError).not.toHaveBeenCalled()
    })
  })

  describe('error path — control flow', () => {
    it('returns undefined instead of re-throwing', async () => {
      const result = await runWithErrorNode(store, makeNode('n1'), logError, async () => {
        throw new Error('oops')
      })
      expect(result).toBeUndefined()
    })

    it('calls logError with the exact thrown value', async () => {
      const err = new Error('boom')
      await runWithErrorNode(store, makeNode('n1'), logError, async () => {
        throw err
      })
      expect(logError).toHaveBeenCalledWith(err)
    })

    it('calls createErrorNode on the correct node id', async () => {
      await runWithErrorNode(store, makeNode('target-node'), logError, async () => {
        throw new Error('fail')
      })
      expect(store.importer.createErrorNode).toHaveBeenCalledWith(expect.any(String), 'target-node')
    })

    it('calls createErrorNode exactly once per thrown error', async () => {
      await runWithErrorNode(store, makeNode('n1'), logError, async () => {
        throw new Error('single')
      })
      expect(store.importer.createErrorNode).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['DOMException AbortError', new DOMException('aborted', 'AbortError')],
      ['Error named AbortError', Object.assign(new Error('Operation cancelled'), {name: 'AbortError'})],
    ])('rethrows %s without logging or creating an error node', async (_label, err) => {
      await expect(
        runWithErrorNode(store, makeNode('n1'), logError, async () => {
          throw err
        }),
      ).rejects.toBe(err)

      expect(logError).not.toHaveBeenCalled()
      expect(store.importer.createErrorNode).not.toHaveBeenCalled()
    })
  })

  describe('error node message — Error instances', () => {
    it.each([
      ['Error', new Error('detailed failure')],
      ['TypeError', new TypeError('type mismatch')],
      ['RangeError', new RangeError('value out of range')],
      ['named Error subclass', Object.assign(new Error('domain-specific failure'), {name: 'DomainError'})],
    ])('uses .message for %s', async (_label, err) => {
      await runWithErrorNode(store, makeNode('n1'), logError, async () => {
        throw err
      })
      expect(store.importer.createErrorNode).toHaveBeenCalledWith(`Error: ${err.message}`, 'n1')
    })

    it('falls back to "Unknown error" when Error.message is empty', async () => {
      await runWithErrorNode(store, makeNode('n1'), logError, async () => {
        throw new Error('')
      })
      expect(store.importer.createErrorNode).toHaveBeenCalledWith('Error: Unknown error', 'n1')
    })
  })

  describe('error node message — non-Error throws', () => {
    it.each([
      ['string', 'plain string error', 'Error: plain string error'],
      ['number', 42, 'Error: 42'],
      ['null', null, 'Error: null'],
      ['undefined', undefined, 'Error: undefined'],
      ['plain object', {message: 'structured'}, 'Error: [object Object]'],
    ])('coerces %s to string via String()', async (_label, thrown, expectedMessage) => {
      await runWithErrorNode(store, makeNode('n1'), logError, async () => {
        throw thrown // eslint-disable-line no-throw-literal
      })
      expect(store.importer.createErrorNode).toHaveBeenCalledWith(expectedMessage, 'n1')
    })
  })
})
