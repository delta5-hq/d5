import {
  mcpAliasToQueryType,
  rpcAliasToQueryType,
  resolveQueryType,
  findMCPAliasByQueryType,
  findRPCAliasByQueryType,
} from './queryTypeResolver'

const mkMCPAlias = alias => ({alias})
const mkRPCAlias = alias => ({alias})

describe('queryTypeResolver', () => {
  describe('mcpAliasToQueryType', () => {
    it.each([
      ['/coder1', 'mcp:coder1'],
      ['/agent-x', 'mcp:agent-x'],
      ['/my_tool', 'mcp:my_tool'],
      ['/x', 'mcp:x'],
      ['noSlash', 'mcp:noSlash'],
    ])('converts %s → %s', (input, expected) => {
      expect(mcpAliasToQueryType(input)).toBe(expected)
    })
  })

  describe('rpcAliasToQueryType', () => {
    it.each([
      ['/vm3', 'rpc:vm3'],
      ['/ssh-cmd', 'rpc:ssh-cmd'],
      ['/remote_exec', 'rpc:remote_exec'],
      ['/x', 'rpc:x'],
      ['noSlash', 'rpc:noSlash'],
    ])('converts %s → %s', (input, expected) => {
      expect(rpcAliasToQueryType(input)).toBe(expected)
    })
  })

  describe('resolveQueryType', () => {
    const mcpAliases = [mkMCPAlias('/coder1'), mkMCPAlias('/agent2')]
    const rpcAliases = [mkRPCAlias('/vm3'), mkRPCAlias('/ssh-remote')]

    describe('built-in command resolution (highest priority)', () => {
      it.each([
        ['/chatgpt hello', 'chat'],
        ['/web search', 'web'],
        ['/scholar query', 'scholar'],
        ['/steps', 'steps'],
        ['/foreach', 'foreach'],
        ['/switch', 'switch'],
      ])('resolves built-in: %s → %s', (input, expected) => {
        expect(resolveQueryType(input, {mcpAliases, rpcAliases})).toBe(expected)
      })

      it('prioritizes built-in over MCP when alias conflicts', () => {
        const conflictingMCP = [mkMCPAlias('/chatgpt')]
        expect(resolveQueryType('/chatgpt test', {mcpAliases: conflictingMCP})).toBe('chat')
      })

      it('prioritizes built-in over RPC when alias conflicts', () => {
        const conflictingRPC = [mkRPCAlias('/web')]
        expect(resolveQueryType('/web search', {rpcAliases: conflictingRPC})).toBe('web')
      })
    })

    describe('MCP alias resolution (second priority)', () => {
      it.each([
        ['/coder1 fix bug', 'mcp:coder1'],
        ['/agent2 analyze', 'mcp:agent2'],
      ])('resolves MCP: %s → %s', (input, expected) => {
        expect(resolveQueryType(input, {mcpAliases})).toBe(expected)
      })

      it('prioritizes MCP over RPC when both have same alias', () => {
        const shared = [mkMCPAlias('/shared')]
        const rpcShared = [mkRPCAlias('/shared')]
        expect(resolveQueryType('/shared cmd', {mcpAliases: shared, rpcAliases: rpcShared})).toBe('mcp:shared')
      })
    })

    describe('RPC alias resolution (third priority)', () => {
      it.each([
        ['/vm3 ls', 'rpc:vm3'],
        ['/ssh-remote pwd', 'rpc:ssh-remote'],
      ])('resolves RPC: %s → %s', (input, expected) => {
        expect(resolveQueryType(input, {rpcAliases})).toBe(expected)
      })

      it('resolves RPC when no MCP match exists', () => {
        expect(resolveQueryType('/vm3 cmd', {mcpAliases, rpcAliases})).toBe('rpc:vm3')
      })
    })

    describe('unresolved commands', () => {
      it.each([['/unknown'], ['text'], [''], [null], [undefined]])('returns undefined for: %s', input => {
        expect(resolveQueryType(input, {mcpAliases, rpcAliases})).toBeUndefined()
      })
    })

    describe('parameter handling', () => {
      it('works without options parameter', () => {
        expect(resolveQueryType('/chatgpt')).toBe('chat')
        expect(resolveQueryType('/unknown')).toBeUndefined()
      })

      it('works with empty alias arrays', () => {
        expect(resolveQueryType('/chatgpt', {mcpAliases: [], rpcAliases: []})).toBe('chat')
        expect(resolveQueryType('/nonexistent', {mcpAliases: [], rpcAliases: []})).toBeUndefined()
      })

      it('works with only mcpAliases provided', () => {
        expect(resolveQueryType('/coder1', {mcpAliases})).toBe('mcp:coder1')
      })

      it('works with only rpcAliases provided', () => {
        expect(resolveQueryType('/vm3', {rpcAliases})).toBe('rpc:vm3')
      })
    })

    describe('edge cases', () => {
      it('handles whitespace in input', () => {
        expect(resolveQueryType('  /chatgpt', {mcpAliases})).toBe('chat')
        expect(resolveQueryType('  /coder1', {mcpAliases})).toBe('mcp:coder1')
      })

      it('handles exact alias match without trailing content', () => {
        expect(resolveQueryType('/coder1', {mcpAliases})).toBe('mcp:coder1')
      })

      it('handles aliases with special characters', () => {
        const special = [mkMCPAlias('/my-tool_v2')]
        expect(resolveQueryType('/my-tool_v2 cmd', {mcpAliases: special})).toBe('mcp:my-tool_v2')
      })
    })
  })

  describe('findMCPAliasByQueryType', () => {
    const aliases = [
      mkMCPAlias('/toolA'),
      mkMCPAlias('/toolB'),
      mkMCPAlias('/tool-with-dash'),
      mkMCPAlias('/tool_with_underscore'),
    ]

    it.each([
      ['mcp:toolA', mkMCPAlias('/toolA')],
      ['mcp:toolB', mkMCPAlias('/toolB')],
      ['mcp:tool-with-dash', mkMCPAlias('/tool-with-dash')],
      ['mcp:tool_with_underscore', mkMCPAlias('/tool_with_underscore')],
    ])('finds alias for queryType: %s', (queryType, expected) => {
      expect(findMCPAliasByQueryType(aliases, queryType)).toEqual(expected)
    })

    it.each([
      ['mcp:nonexistent', 'non-existent MCP'],
      ['rpc:vm3', 'RPC queryType'],
      ['chat', 'built-in queryType'],
      ['', 'empty string'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('returns undefined for: %s (%s)', queryType => {
      expect(findMCPAliasByQueryType(aliases, queryType)).toBeUndefined()
    })

    it('returns undefined for empty aliases array', () => {
      expect(findMCPAliasByQueryType([], 'mcp:toolA')).toBeUndefined()
    })

    it('matches first occurrence when duplicates exist', () => {
      const dupes = [mkMCPAlias('/tool'), {alias: '/tool', extra: 'data'}]
      expect(findMCPAliasByQueryType(dupes, 'mcp:tool')).toEqual(dupes[0])
    })
  })

  describe('findRPCAliasByQueryType', () => {
    const aliases = [mkRPCAlias('/vm1'), mkRPCAlias('/vm2'), mkRPCAlias('/ssh-host')]

    it.each([
      ['rpc:vm1', mkRPCAlias('/vm1')],
      ['rpc:vm2', mkRPCAlias('/vm2')],
      ['rpc:ssh-host', mkRPCAlias('/ssh-host')],
    ])('finds alias for queryType: %s', (queryType, expected) => {
      expect(findRPCAliasByQueryType(aliases, queryType)).toEqual(expected)
    })

    it.each([
      ['rpc:nonexistent', 'non-existent RPC'],
      ['mcp:coder1', 'MCP queryType'],
      ['web', 'built-in queryType'],
      ['', 'empty string'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('returns undefined for: %s (%s)', queryType => {
      expect(findRPCAliasByQueryType(aliases, queryType)).toBeUndefined()
    })

    it('returns undefined for empty aliases array', () => {
      expect(findRPCAliasByQueryType([], 'rpc:vm1')).toBeUndefined()
    })
  })

  describe('integration scenarios', () => {
    const mcpAliases = [mkMCPAlias('/coder1'), mkMCPAlias('/agent')]
    const rpcAliases = [mkRPCAlias('/vm3'), mkRPCAlias('/deploy')]

    it('resolves full workflow with mixed command types', () => {
      const commands = [
        ['/chatgpt summarize', 'chat'],
        ['/coder1 fix bug', 'mcp:coder1'],
        ['/web search topic', 'web'],
        ['/vm3 run tests', 'rpc:vm3'],
        ['/agent analyze', 'mcp:agent'],
      ]

      commands.forEach(([input, expected]) => {
        expect(resolveQueryType(input, {mcpAliases, rpcAliases})).toBe(expected)
      })
    })

    it('round-trip: queryType → findAlias → queryType', () => {
      const original = 'mcp:coder1'
      const found = findMCPAliasByQueryType(mcpAliases, original)
      expect(found).toBeDefined()
      const converted = mcpAliasToQueryType(found.alias)
      expect(converted).toBe(original)
    })
  })
})
