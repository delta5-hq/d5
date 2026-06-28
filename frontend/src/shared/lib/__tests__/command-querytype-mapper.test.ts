import { describe, it, expect } from 'vitest'
import {
  extractQueryTypeFromCommand,
  getFullCommandMap,
  getSupportedCommands,
  COMMAND_TO_QUERYTYPE_MAP,
  COMMAND_DESCRIPTIONS,
  type DynamicAlias,
} from '../command-querytype-mapper'
import { BUILTIN_COMMAND_ALIASES, BUILTIN_COMMANDS } from '../builtin-command-aliases'

describe('extractQueryTypeFromCommand - Command Mapping', () => {
  describe('registered commands', () => {
    it.each(BUILTIN_COMMANDS)('maps $alias to $queryType', ({ alias, queryType }) => {
      expect(extractQueryTypeFromCommand(`${alias} some prompt text`)).toBe(queryType)
    })

    it.each(BUILTIN_COMMANDS)('maps $alias with no trailing text', ({ alias, queryType }) => {
      expect(extractQueryTypeFromCommand(alias)).toBe(queryType)
    })
  })

  describe('fallback behavior', () => {
    it('maps unknown slash commands to explicit unknown query type', () => {
      expect(extractQueryTypeFromCommand('/unknown Do something')).toBe('unknown')
    })

    it('does not derive executable query types from unregistered slash commands', () => {
      expect(extractQueryTypeFromCommand('/newfeature Test')).toBe('unknown')
    })

    it('handles commands without slash prefix — defaults to chat', () => {
      expect(extractQueryTypeFromCommand('chat Hello')).toBe('chat')
    })

    it('returns chat for non-slash text (generated output has no command)', () => {
      expect(extractQueryTypeFromCommand('custom Direct query')).toBe('chat')
    })

    it('returns chat for arbitrary generated text without slash prefix', () => {
      expect(extractQueryTypeFromCommand('Here is your outline:')).toBe('chat')
    })
  })

  describe('edge cases', () => {
    it('defaults to chat for empty string', () => {
      expect(extractQueryTypeFromCommand('')).toBe('chat')
    })

    it('defaults to chat for undefined', () => {
      expect(extractQueryTypeFromCommand(undefined)).toBe('chat')
    })

    it('extracts first word from multi-word commands', () => {
      expect(extractQueryTypeFromCommand('/web search for documentation')).toBe('web')
    })

    it('handles command with only whitespace after slash', () => {
      expect(extractQueryTypeFromCommand('/   ')).toBe('unknown')
    })

    it('handles bare slash as unknown command', () => {
      expect(extractQueryTypeFromCommand('/')).toBe('unknown')
    })

    it('trims leading whitespace', () => {
      expect(extractQueryTypeFromCommand('   /web query')).toBe('web')
    })

    it('trims trailing whitespace', () => {
      expect(extractQueryTypeFromCommand('/web query   ')).toBe('web')
    })

    it('handles multiple spaces between command and text', () => {
      expect(extractQueryTypeFromCommand('/web     search query')).toBe('web')
    })

    it('handles tab characters', () => {
      expect(extractQueryTypeFromCommand('/web\t\tsearch')).toBe('web')
    })

    it('handles newline characters', () => {
      expect(extractQueryTypeFromCommand('/web\nsearch')).toBe('web')
    })

    it('handles command with no text after', () => {
      expect(extractQueryTypeFromCommand('/web')).toBe('web')
    })

    it('handles double slash as unknown command', () => {
      expect(extractQueryTypeFromCommand('//web')).toBe('unknown')
    })

    it('returns chat for input without leading slash even if it contains a slash mid-word', () => {
      expect(extractQueryTypeFromCommand('web/search query')).toBe('chat')
    })

    it('does not preserve unknown command text as an executable query type', () => {
      expect(extractQueryTypeFromCommand('/UnknownCommand')).toBe('unknown')
    })

    it('handles very long command names', () => {
      const longCommand = '/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      expect(extractQueryTypeFromCommand(longCommand)).toBe('unknown')
    })

    it('handles special characters in unknown commands', () => {
      expect(extractQueryTypeFromCommand('/@#$%')).toBe('unknown')
    })

    it('handles unicode characters', () => {
      expect(extractQueryTypeFromCommand('/查询 search')).toBe('unknown')
    })

    it('handles emoji in command', () => {
      expect(extractQueryTypeFromCommand('/🔍 search')).toBe('unknown')
    })
  })
})

describe('getFullCommandMap - Dynamic Alias Merging', () => {
  describe('without dynamic aliases', () => {
    it('returns static map when no aliases provided', () => {
      const map = getFullCommandMap()
      expect(map).toEqual(COMMAND_TO_QUERYTYPE_MAP)
    })

    it('returns static map when empty array provided', () => {
      const map = getFullCommandMap([])
      expect(map).toEqual(COMMAND_TO_QUERYTYPE_MAP)
    })

    it('does not mutate original COMMAND_TO_QUERYTYPE_MAP', () => {
      const originalKeys = Object.keys(COMMAND_TO_QUERYTYPE_MAP)
      getFullCommandMap([{ alias: '/test', queryType: 'test' }])
      expect(Object.keys(COMMAND_TO_QUERYTYPE_MAP)).toEqual(originalKeys)
    })
  })

  describe('with dynamic aliases', () => {
    it('adds single dynamic alias with explicit queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/myalias', queryType: 'custom' }]
      const map = getFullCommandMap(aliases)
      expect(map['/myalias']).toBe('custom')
    })

    it('adds multiple dynamic aliases', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/code', queryType: 'mcp:code' },
        { alias: '/qa', queryType: 'mcp:qa' },
      ]
      const map = getFullCommandMap(aliases)
      expect(map['/code']).toBe('mcp:code')
      expect(map['/qa']).toBe('mcp:qa')
    })

    it('derives queryType from alias when not provided', () => {
      const aliases: DynamicAlias[] = [{ alias: '/research' }]
      const map = getFullCommandMap(aliases)
      expect(map['/research']).toBe('research')
    })

    it('preserves all static commands when adding dynamic aliases', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test' }]
      const map = getFullCommandMap(aliases)
      expect(map['/web']).toBe('web')
      expect(map['/chatgpt']).toBe('chat')
      expect(map['/claude']).toBe('claude')
    })

    it.each(Object.entries(COMMAND_TO_QUERYTYPE_MAP))(
      'does not override static command %s with a dynamic alias',
      (alias, queryType) => {
        const aliases: DynamicAlias[] = [{ alias, queryType: 'override' }]
        const map = getFullCommandMap(aliases)
        expect(map[alias]).toBe(queryType)
      },
    )

    it('does not override static commands during query extraction', () => {
      const aliases: DynamicAlias[] = [{ alias: '/mcp', queryType: 'override' }]
      const map = getFullCommandMap(aliases)
      expect(map['/mcp']).toBe('mcp-fusion')
      expect(extractQueryTypeFromCommand('/mcp use every tool', aliases)).toBe('mcp-fusion')
    })

    it('ignores alias with empty string', () => {
      const aliases: DynamicAlias[] = [{ alias: '', queryType: 'empty' }]
      const map = getFullCommandMap(aliases)
      expect(map['']).toBeUndefined()
    })

    it('handles alias without leading slash', () => {
      const aliases: DynamicAlias[] = [{ alias: 'noslash', queryType: 'custom' }]
      const map = getFullCommandMap(aliases)
      expect(map['noslash']).toBe('custom')
    })

    it('handles duplicate aliases (last one is ignored)', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/duplicate', queryType: 'first' },
        { alias: '/duplicate', queryType: 'second' },
      ]
      const map = getFullCommandMap(aliases)
      expect(map['/duplicate']).toBe('first')
    })

    it('handles alias with special characters', () => {
      const aliases: DynamicAlias[] = [{ alias: '/c++', queryType: 'cpp' }]
      const map = getFullCommandMap(aliases)
      expect(map['/c++']).toBe('cpp')
    })

    it('handles alias with unicode', () => {
      const aliases: DynamicAlias[] = [{ alias: '/查询', queryType: 'search_cn' }]
      const map = getFullCommandMap(aliases)
      expect(map['/查询']).toBe('search_cn')
    })

    it('derives correct queryType when alias has leading slash', () => {
      const aliases: DynamicAlias[] = [{ alias: '/mycommand' }]
      const map = getFullCommandMap(aliases)
      expect(map['/mycommand']).toBe('mycommand')
    })

    it('handles mixed explicit and derived queryTypes', () => {
      const aliases: DynamicAlias[] = [{ alias: '/explicit', queryType: 'custom_type' }, { alias: '/derived' }]
      const map = getFullCommandMap(aliases)
      expect(map['/explicit']).toBe('custom_type')
      expect(map['/derived']).toBe('derived')
    })
  })

  describe('edge cases', () => {
    it('handles alias with undefined queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: undefined }]
      const map = getFullCommandMap(aliases)
      expect(map['/test']).toBe('test')
    })

    it('handles alias with null-like queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: '' }]
      const map = getFullCommandMap(aliases)
      expect(map['/test']).toBe('test')
    })

    it('derives empty string queryType when alias is bare slash and queryType is absent', () => {
      const aliases: DynamicAlias[] = [{ alias: '/', queryType: '' }]
      const map = getFullCommandMap(aliases)
      expect(map['/']).toBe('')
    })

    it('handles very long alias names', () => {
      const longAlias = '/' + 'a'.repeat(100)
      const aliases: DynamicAlias[] = [{ alias: longAlias, queryType: 'long' }]
      const map = getFullCommandMap(aliases)
      expect(map[longAlias]).toBe('long')
    })

    it('handles alias with only slash with an explicit queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/', queryType: 'slash' }]
      const map = getFullCommandMap(aliases)
      expect(map['/']).toBe('slash')
    })

    it('returns new object instance on each call', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test' }]
      const map1 = getFullCommandMap(aliases)
      const map2 = getFullCommandMap(aliases)
      expect(map1).not.toBe(map2)
      expect(map1).toEqual(map2)
    })
  })
})

describe('getSupportedCommands - Command List Generation', () => {
  describe('without dynamic aliases', () => {
    it('returns all static command keys when no aliases provided', () => {
      const commands = getSupportedCommands()
      const staticKeys = Object.keys(COMMAND_TO_QUERYTYPE_MAP)
      expect(commands).toEqual(staticKeys)
    })

    it('returns all static command keys when empty array provided', () => {
      const commands = getSupportedCommands([])
      const staticKeys = Object.keys(COMMAND_TO_QUERYTYPE_MAP)
      expect(commands).toEqual(staticKeys)
    })

    it('includes all expected static commands', () => {
      const commands = getSupportedCommands()
      expect(commands).toContain('/web')
      expect(commands).toContain('/chatgpt')
      expect(commands).toContain('/claude')
      expect(commands).toContain('/download')
      expect(commands).toContain('/case')
    })

    it('returns readonly array', () => {
      const commands = getSupportedCommands()
      expect(Object.isFrozen(commands)).toBe(false)
      expect(Array.isArray(commands)).toBe(true)
    })
  })

  describe('with dynamic aliases', () => {
    it('includes dynamic alias in command list', () => {
      const aliases: DynamicAlias[] = [{ alias: '/mycommand', queryType: 'custom' }]
      const commands = getSupportedCommands(aliases)
      expect(commands).toContain('/mycommand')
    })

    it('includes multiple dynamic aliases', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/code', queryType: 'mcp:code' },
        { alias: '/qa', queryType: 'mcp:qa' },
      ]
      const commands = getSupportedCommands(aliases)
      expect(commands).toContain('/code')
      expect(commands).toContain('/qa')
    })

    it('includes both static and dynamic commands', () => {
      const aliases: DynamicAlias[] = [{ alias: '/custom', queryType: 'test' }]
      const commands = getSupportedCommands(aliases)
      expect(commands).toContain('/web')
      expect(commands).toContain('/custom')
    })

    it.each(Object.keys(COMMAND_TO_QUERYTYPE_MAP))('does not duplicate static command %s', alias => {
      const aliases: DynamicAlias[] = [{ alias, queryType: 'override' }]
      const commands = getSupportedCommands(aliases)
      expect(commands.filter(cmd => cmd === alias)).toHaveLength(1)
    })

    it('maintains command order (insertion order from map keys)', () => {
      const aliases: DynamicAlias[] = [{ alias: '/zzz', queryType: 'last' }]
      const commands = getSupportedCommands(aliases)
      expect(Array.isArray(commands)).toBe(true)
      expect(commands.length).toBeGreaterThan(0)
    })
  })

  describe('consistency with getFullCommandMap', () => {
    it('returns keys matching getFullCommandMap output', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test1', queryType: 'type1' }, { alias: '/test2' }]
      const commands = getSupportedCommands(aliases)
      const map = getFullCommandMap(aliases)
      expect(commands).toEqual(Object.keys(map))
    })

    it('reflects same alias behavior as getFullCommandMap', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'override' }]
      const commands = getSupportedCommands(aliases)
      const map = getFullCommandMap(aliases)
      expect(commands.length).toBe(Object.keys(map).length)
    })
  })
})

describe('extractQueryTypeFromCommand - With Dynamic Aliases', () => {
  describe('dynamic alias resolution', () => {
    it('resolves dynamic alias to its queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
      expect(extractQueryTypeFromCommand('/code analyze this', aliases)).toBe('mcp:code')
    })

    it('resolves multiple dynamic aliases correctly', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/code', queryType: 'mcp:code' },
        { alias: '/qa', queryType: 'mcp:qa' },
      ]
      expect(extractQueryTypeFromCommand('/code test', aliases)).toBe('mcp:code')
      expect(extractQueryTypeFromCommand('/qa verify', aliases)).toBe('mcp:qa')
    })

    it('prefers static command over dynamic when both exist', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'custom_web' }]
      expect(extractQueryTypeFromCommand('/web search', aliases)).toBe('web')
    })

    it('resolves derived queryType from alias when queryType is omitted', () => {
      const aliases: DynamicAlias[] = [{ alias: '/research' }]
      expect(extractQueryTypeFromCommand('/research query', aliases)).toBe('research')
    })

    it('resolves alias used without trailing prompt text', () => {
      const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
      expect(extractQueryTypeFromCommand('/code', aliases)).toBe('mcp:code')
    })

    it('trims surrounding whitespace before resolving dynamic alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test_type' }]
      expect(extractQueryTypeFromCommand('  /test  query  ', aliases)).toBe('test_type')
    })

    it('returns unknown for a command that is absent from both static and dynamic registries', () => {
      const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known_type' }]
      expect(extractQueryTypeFromCommand('/unknown query', aliases)).toBe('unknown')
    })
  })

  describe('queryType value passthrough', () => {
    it.each(['namespace:tool', 'my_custom_type', 'my-custom-type', 'ns:my_tool-v2', 'mcp:sub:tool'])(
      'passes queryType string %s through without transformation',
      queryType => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType }]
        expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe(queryType)
      },
    )
  })

  describe('alias character patterns', () => {
    it.each(['/my-tool', '/my_tool', '/MyTool', '/tool2', '/my-tool_v2'])(
      'resolves alias %s regardless of embedded separators or case',
      alias => {
        const aliases: DynamicAlias[] = [{ alias, queryType: 'custom' }]
        expect(extractQueryTypeFromCommand(`${alias} cmd`, aliases)).toBe('custom')
      },
    )
  })

  describe('edge cases', () => {
    it('produces identical results when aliases list is absent versus empty', () => {
      expect(extractQueryTypeFromCommand('/web search')).toBe('web')
      expect(extractQueryTypeFromCommand('/web search', [])).toBe('web')
      expect(extractQueryTypeFromCommand('', [])).toBe('chat')
      expect(extractQueryTypeFromCommand(undefined, [])).toBe('chat')
    })

    it('returns chat when command lacks a leading slash even if a no-slash alias is registered', () => {
      const aliases: DynamicAlias[] = [{ alias: 'noslash', queryType: 'custom' }]
      expect(extractQueryTypeFromCommand('noslash cmd', aliases)).toBe('chat')
    })

    it('always returns a string regardless of queryType value stored in the alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: '   ' }]
      expect(typeof extractQueryTypeFromCommand('/tool run', aliases)).toBe('string')
    })
  })

  describe('priority and shadowing behavior', () => {
    it('static command takes priority over any dynamic alias with the same name', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/web', queryType: 'custom1' },
        { alias: '/chatgpt', queryType: 'custom2' },
      ]
      expect(extractQueryTypeFromCommand('/web search', aliases)).toBe('web')
      expect(extractQueryTypeFromCommand('/chatgpt ask', aliases)).toBe('chat')
    })

    it('first occurrence wins when duplicate dynamic aliases are registered', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/tool', queryType: 'first' },
        { alias: '/tool', queryType: 'second' },
      ]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('first')
    })

    it('alias matching is case-sensitive', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/Tool', queryType: 'capitalized' },
        { alias: '/tool', queryType: 'lowercase' },
      ]
      expect(extractQueryTypeFromCommand('/Tool run', aliases)).toBe('capitalized')
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('lowercase')
    })
  })
})

describe('COMMAND_DESCRIPTIONS and COMMAND_TO_QUERYTYPE_MAP consistency', () => {
  it('keys of both maps match BUILTIN_COMMAND_ALIASES in insertion order', () => {
    const aliases = [...BUILTIN_COMMAND_ALIASES]
    expect(Object.keys(COMMAND_TO_QUERYTYPE_MAP)).toEqual(aliases)
    expect(Object.keys(COMMAND_DESCRIPTIONS)).toEqual(aliases)
  })

  it.each(BUILTIN_COMMANDS)(
    'COMMAND_TO_QUERYTYPE_MAP[$alias] equals source queryType $queryType',
    ({ alias, queryType }) => {
      expect(COMMAND_TO_QUERYTYPE_MAP[alias]).toBe(queryType)
    },
  )

  it.each(BUILTIN_COMMANDS)('COMMAND_DESCRIPTIONS[$alias] equals source description', ({ alias, description }) => {
    expect(COMMAND_DESCRIPTIONS[alias]).toBe(description)
  })
})
