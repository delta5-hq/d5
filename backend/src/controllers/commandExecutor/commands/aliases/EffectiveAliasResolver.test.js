import {EffectiveAliasResolver} from './EffectiveAliasResolver'

const mcpItem = (alias, extra = {}) => ({alias, transport: 'stdio', toolName: 'tool', ...extra})
const rpcItem = (alias, extra = {}) => ({alias, protocol: 'http', url: 'http://localhost', ...extra})

const otherTypeOf = service => (service === 'mcp' ? 'rpc' : 'mcp')
const makeItemOf = service => (service === 'mcp' ? rpcItem : mcpItem)

describe('EffectiveAliasResolver', () => {
  let resolver

  beforeEach(() => {
    resolver = new EffectiveAliasResolver()
  })

  describe('resolveOtherType — reads other-type field, ignores same-type field', () => {
    it.each([['mcp'], ['rpc']])('service=%s: returns empty when appWide only has same-type field', service => {
      const appWide = {[service]: [mcpItem('/same-type-only')]}
      expect(resolver.resolveOtherType(service, {appWide, workflow: null})).toEqual([])
    })

    it.each([['mcp'], ['rpc']])('service=%s: returns global other-type items when no workflow doc', service => {
      const otherType = otherTypeOf(service)
      const makeItem = makeItemOf(service)
      const appWide = {[otherType]: [makeItem('/a'), makeItem('/b')]}
      const result = resolver.resolveOtherType(service, {appWide, workflow: null})
      expect(result.map(i => i.alias)).toEqual(['/a', '/b'])
    })
  })

  describe('resolveOtherType — merge semantics: workflow overrides global by alias', () => {
    it.each([['mcp'], ['rpc']])(
      'service=%s: workflow-only items are present alongside non-overridden global items',
      service => {
        const otherType = otherTypeOf(service)
        const makeItem = makeItemOf(service)
        const appWide = {[otherType]: [makeItem('/global-only'), makeItem('/shared')]}
        const workflow = {[otherType]: [makeItem('/shared'), makeItem('/workflow-only')]}
        const result = resolver.resolveOtherType(service, {appWide, workflow})
        expect(result.map(i => i.alias)).toEqual(['/shared', '/workflow-only', '/global-only'])
      },
    )

    it.each([['mcp'], ['rpc']])(
      'service=%s: when alias is shared, the workflow version of the item is used, not the global version',
      service => {
        const otherType = otherTypeOf(service)
        const makeItem = makeItemOf(service)
        const appWide = {[otherType]: [makeItem('/shared', {url: 'http://global'})]}
        const workflow = {[otherType]: [makeItem('/shared', {url: 'http://workflow'})]}
        const result = resolver.resolveOtherType(service, {appWide, workflow})
        expect(result).toHaveLength(1)
        expect(result[0].url).toBe('http://workflow')
      },
    )

    it.each([['mcp'], ['rpc']])(
      'service=%s: when all global aliases are overridden by workflow, no duplicates appear',
      service => {
        const otherType = otherTypeOf(service)
        const makeItem = makeItemOf(service)
        const appWide = {[otherType]: [makeItem('/a'), makeItem('/b')]}
        const workflow = {[otherType]: [makeItem('/a'), makeItem('/b')]}
        const result = resolver.resolveOtherType(service, {appWide, workflow})
        expect(result).toHaveLength(2)
        expect(result.map(i => i.alias)).toEqual(['/a', '/b'])
      },
    )

    it.each([['mcp'], ['rpc']])(
      'service=%s: explicit empty workflow array returns empty (wipe semantics, not fallback)',
      service => {
        const otherType = otherTypeOf(service)
        const makeItem = makeItemOf(service)
        const appWide = {[otherType]: [makeItem('/global-a')]}
        const workflow = {[otherType]: []}
        const result = resolver.resolveOtherType(service, {appWide, workflow})
        expect(result).toEqual([])
      },
    )
  })

  describe('resolveOtherType — null and missing doc edge cases', () => {
    it.each([['mcp'], ['rpc']])('service=%s: both docs null returns empty array', service => {
      expect(resolver.resolveOtherType(service, {appWide: null, workflow: null})).toEqual([])
    })

    it.each([['mcp'], ['rpc']])('service=%s: both docs undefined returns empty array', service => {
      expect(resolver.resolveOtherType(service, {appWide: undefined, workflow: undefined})).toEqual([])
    })

    it.each([['mcp'], ['rpc']])('service=%s: workflow null falls back to global items only', service => {
      const otherType = otherTypeOf(service)
      const makeItem = makeItemOf(service)
      const appWide = {[otherType]: [makeItem('/global-a')]}
      expect(resolver.resolveOtherType(service, {appWide, workflow: null}).map(i => i.alias)).toEqual(['/global-a'])
    })

    it.each([['mcp'], ['rpc']])('service=%s: appWide null uses workflow items only', service => {
      const otherType = otherTypeOf(service)
      const makeItem = makeItemOf(service)
      const workflow = {[otherType]: [makeItem('/workflow-a')]}
      expect(resolver.resolveOtherType(service, {appWide: null, workflow}).map(i => i.alias)).toEqual(['/workflow-a'])
    })

    it.each([['mcp'], ['rpc']])(
      'service=%s: doc that has no other-type field is treated as having an empty array',
      service => {
        const appWide = {[service]: [mcpItem('/same-type-only')]}
        expect(resolver.resolveOtherType(service, {appWide, workflow: null})).toEqual([])
      },
    )
  })
})
