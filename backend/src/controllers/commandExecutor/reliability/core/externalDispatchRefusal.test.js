import Store from '../../commands/utils/Store'
import {
  dispatchIsExternal,
  commandIsExternalDispatch,
  externalDispatchRefusalMessage,
  buildExternalDispatchRefusalMetadata,
} from './externalDispatchRefusal'
import {FAILURE_CAUSE} from './failureSemantics'

const storeWith = (nodeMap, aliases = {mcp: [], rpc: []}) => {
  const store = new Store({userId: 'u', nodes: nodeMap})
  store._aliases = aliases
  return store
}

describe('dispatchIsExternal — node-level predicate over a resolved command', () => {
  it('is true for an MCP-alias node', () => {
    const store = storeWith(
      {p: {id: 'p', command: '/jira create issue', children: []}},
      {mcp: [{alias: '/jira'}], rpc: []},
    )
    expect(dispatchIsExternal(store.getNode('p'), store)).toBe(true)
  })

  it('is true for an RPC-alias node', () => {
    const store = storeWith({p: {id: 'p', command: '/ssh run', children: []}}, {mcp: [], rpc: [{alias: '/ssh'}]})
    expect(dispatchIsExternal(store.getNode('p'), store)).toBe(true)
  })

  it('is true for an /mcp:-shaped node even when no alias is configured', () => {
    const store = storeWith({p: {id: 'p', command: '/mcp:jira create issue', children: []}}, {mcp: [], rpc: []})
    expect(dispatchIsExternal(store.getNode('p'), store)).toBe(true)
  })

  it('is true for an /rpc:-shaped node even when no alias is configured', () => {
    const store = storeWith({p: {id: 'p', command: '/rpc:worker run', children: []}}, {mcp: [], rpc: []})
    expect(dispatchIsExternal(store.getNode('p'), store)).toBe(true)
  })

  it('is false for a native command node', () => {
    const store = storeWith({p: {id: 'p', command: '/chat hello', children: []}})
    expect(dispatchIsExternal(store.getNode('p'), store)).toBe(false)
  })

  it('is false for a missing node', () => {
    const store = storeWith({})
    expect(dispatchIsExternal(null, store)).toBe(false)
    expect(dispatchIsExternal(undefined, store)).toBe(false)
  })
})

describe('commandIsExternalDispatch — command-level predicate reused where no node exists (e.g. an inline term)', () => {
  const store = storeWith({}, {mcp: [{alias: '/jira'}], rpc: [{alias: '/ssh'}]})

  it.each([
    ['/mcp: shape, unconfigured alias', '/mcp:whatever do a thing', true],
    ['/rpc: shape, unconfigured alias', '/rpc:worker run', true],
    ['configured MCP alias', '/jira create issue', true],
    ['configured RPC alias', '/ssh run', true],
    ['native command', '/chat hello', false],
    ['bare text', 'just prose', false],
    ['empty string', '', false],
    ['undefined command', undefined, false],
  ])('is %s -> %s', (_label, command, expected) => {
    expect(commandIsExternalDispatch(command, store)).toBe(expected)
  })
})

describe('externalDispatchRefusalMessage — invariants the spec pins', () => {
  it.each([
    ['/elect', 3],
    ['/refine', 2],
    [':n', 5],
  ])('for %s :n=%i names the requested N and the dispatch classes', (label, n) => {
    const msg = externalDispatchRefusalMessage(label, n)
    expect(msg).toContain(`:n=${n}`)
    expect(msg).toContain('/mcp')
    expect(msg).toContain('/rpc')
    expect(msg.toLowerCase()).toContain('external dispatch')
  })

  it('never uses the retired "side effect" wording', () => {
    expect(externalDispatchRefusalMessage('/elect', 3).toLowerCase()).not.toContain('side effect')
  })
})

describe('buildExternalDispatchRefusalMetadata — refusal is a no-winner verdict carrying the requested N', () => {
  it('records the refusal cause, the requested N, and zero eligible candidates', () => {
    const meta = buildExternalDispatchRefusalMetadata(4)
    expect(meta).toMatchObject({
      failureCause: FAILURE_CAUSE.EXTERNAL_DISPATCH_REFUSED,
      requestedN: 4,
      total: 4,
      eligible: 0,
      winnerForkIndex: null,
      discardedForks: [],
    })
  })

  it('defaults to the invalid mode but accepts a caller mode label', () => {
    expect(buildExternalDispatchRefusalMetadata(2).mode).toBe('invalid')
    expect(buildExternalDispatchRefusalMetadata(2, 'commodity').mode).toBe('commodity')
    expect(buildExternalDispatchRefusalMetadata(2, 'refine').mode).toBe('refine')
  })
})
