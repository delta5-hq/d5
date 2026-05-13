import {runWithErrorNode} from './runWithErrorNode'

const makeStore = () => ({
  importer: {createNodes: jest.fn()},
})

const makeNode = id => ({id})

describe('runWithErrorNode', () => {
  let store
  let logError

  beforeEach(() => {
    store = makeStore()
    logError = jest.fn()
  })

  it('returns the fn return value on success', async () => {
    const result = await runWithErrorNode(store, makeNode('n1'), logError, async () => 42)
    expect(result).toBe(42)
  })

  it('does not call createNodes on success', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => 'ok')
    expect(store.importer.createNodes).not.toHaveBeenCalled()
  })

  it('does not call logError on success', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => 'ok')
    expect(logError).not.toHaveBeenCalled()
  })

  it('calls logError with the thrown error', async () => {
    const err = new Error('boom')
    await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw err
    })
    expect(logError).toHaveBeenCalledWith(err)
  })

  it('creates error node on the correct node id', async () => {
    await runWithErrorNode(store, makeNode('target-node'), logError, async () => {
      throw new Error('fail')
    })
    expect(store.importer.createNodes).toHaveBeenCalledWith(expect.any(String), 'target-node')
  })

  it('prefixes error node content with "Error: "', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw new Error('detailed failure')
    })
    expect(store.importer.createNodes).toHaveBeenCalledWith('Error: detailed failure', 'n1')
  })

  it('handles non-Error throws — converts to string', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw 'plain string error' // eslint-disable-line no-throw-literal
    })
    expect(store.importer.createNodes).toHaveBeenCalledWith('Error: plain string error', 'n1')
  })

  it('handles thrown null — converts to string "null"', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw null // eslint-disable-line no-throw-literal
    })
    expect(store.importer.createNodes).toHaveBeenCalledWith('Error: null', 'n1')
  })

  it('handles thrown Error with empty message — uses "Unknown error" fallback', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw new Error('')
    })
    expect(store.importer.createNodes).toHaveBeenCalledWith('Error: Unknown error', 'n1')
  })

  it('handles thrown number primitive — converts to string', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw 42 // eslint-disable-line no-throw-literal
    })
    expect(store.importer.createNodes).toHaveBeenCalledWith('Error: 42', 'n1')
  })

  it('returns undefined (not throwing) when fn throws', async () => {
    const result = await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw new Error('oops')
    })
    expect(result).toBeUndefined()
  })

  it('creates exactly one error node per thrown error', async () => {
    await runWithErrorNode(store, makeNode('n1'), logError, async () => {
      throw new Error('single')
    })
    expect(store.importer.createNodes).toHaveBeenCalledTimes(1)
  })
})
