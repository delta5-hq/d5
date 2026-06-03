import { describe, it, expect } from 'vitest'
import {
  extractQueryTypeFromCommand,
  getFullCommandMap,
  getSupportedCommands,
  COMMAND_TO_QUERYTYPE_MAP,
  COMMAND_DESCRIPTIONS,
  type DynamicAlias,
} from '../command-querytype-mapper'

describe('extractQueryTypeFromCommand - Command Mapping', () => {
  describe('registered command → queryType mapping', () => {
    it('returns the declared queryType for every registered command', () => {
      for (const [cmd, expectedType] of Object.entries(COMMAND_TO_QUERYTYPE_MAP)) {
        expect(extractQueryTypeFromCommand(cmd)).toBe(expectedType)
        expect(extractQueryTypeFromCommand(`${cmd} text`)).toBe(expectedType)
      }
    })

    it('all commands sharing a queryType resolve to that queryType', () => {
      const groups = new Map<string, string[]>()
      for (const [cmd, qt] of Object.entries(COMMAND_TO_QUERYTYPE_MAP)) {
        const group = groups.get(qt) ?? []
        group.push(cmd)
        groups.set(qt, group)
      }
      for (const [qt, cmds] of groups) {
        if (cmds.length > 1) {
          cmds.forEach(cmd => {
            expect(extractQueryTypeFromCommand(cmd), `${cmd} should resolve to ${qt}`).toBe(qt)
            expect(extractQueryTypeFromCommand(`${cmd} text`), `${cmd} with text should resolve to ${qt}`).toBe(qt)
          })
        }
      }
    })
  })

  describe('inline parameters are transparent to extraction', () => {
    it.each([
      ['/validate :n=3 criterion', 'validate'],
      ['/validate :retry=5 criterion', 'validate'],
      ['/refine :n=3', 'refine'],
      ['/refine :n=3 :fallback', 'refine'],
      ['/refine :n=2 :limit=xs', 'refine'],
      ['/foreach --parallel=yes items', 'foreach'],
    ])('extractQueryTypeFromCommand(%s) → %s', (input, expected) => {
      expect(extractQueryTypeFromCommand(input)).toBe(expected)
    })
  })

  describe('fallback behavior for unregistered commands', () => {
    it('strips leading slash from unknown slash-commands', () => {
      expect(extractQueryTypeFromCommand('/unknown Do something')).toBe('unknown')
      expect(extractQueryTypeFromCommand('/newfeature Test')).toBe('newfeature')
    })

    it('returns first word for slash-free input', () => {
      expect(extractQueryTypeFromCommand('chat Hello')).toBe('chat')
      expect(extractQueryTypeFromCommand('custom Direct query')).toBe('custom')
    })

    it('preserves case for unregistered commands', () => {
      expect(extractQueryTypeFromCommand('/UnknownCommand')).toBe('UnknownCommand')
    })
  })

  describe('default values', () => {
    it('defaults to chat for undefined', () => {
      expect(extractQueryTypeFromCommand(undefined)).toBe('chat')
    })

    it('defaults to chat for empty string', () => {
      expect(extractQueryTypeFromCommand('')).toBe('chat')
    })
  })

  describe('input normalization', () => {
    it('extracts from first word only regardless of trailing text', () => {
      expect(extractQueryTypeFromCommand('/web search for documentation')).toBe('web')
    })

    it('trims leading whitespace', () => {
      expect(extractQueryTypeFromCommand('   /web query')).toBe('web')
    })

    it('handles multiple spaces between command and text', () => {
      expect(extractQueryTypeFromCommand('/web     search query')).toBe('web')
    })

    it('handles tab and newline whitespace', () => {
      expect(extractQueryTypeFromCommand('/web\t\tsearch')).toBe('web')
      expect(extractQueryTypeFromCommand('/web\nsearch')).toBe('web')
    })

    it('handles command with no text after', () => {
      expect(extractQueryTypeFromCommand('/web')).toBe('web')
    })
  })

  describe('edge cases', () => {
    it('handles double slash as unknown command starting with slash', () => {
      expect(extractQueryTypeFromCommand('//web')).toBe('/web')
    })

    it('handles slash in middle of non-command text', () => {
      expect(extractQueryTypeFromCommand('web/search query')).toBe('web/search')
    })

    it('handles unicode characters in unknown commands', () => {
      expect(extractQueryTypeFromCommand('/查询 search')).toBe('查询')
    })

    it('handles emoji in unknown command name', () => {
      expect(extractQueryTypeFromCommand('/🔍 search')).toBe('🔍')
    })

    it('handles very long unknown command names', () => {
      const longCommand = '/' + 'a'.repeat(100)
      expect(extractQueryTypeFromCommand(longCommand)).toBe('a'.repeat(100))
    })
  })
})

describe('getFullCommandMap - Dynamic Alias Merging', () => {
  describe('without dynamic aliases', () => {
    it('returns a map equal to COMMAND_TO_QUERYTYPE_MAP when no aliases provided', () => {
      expect(getFullCommandMap()).toEqual(COMMAND_TO_QUERYTYPE_MAP)
    })

    it('returns a map equal to COMMAND_TO_QUERYTYPE_MAP when empty array provided', () => {
      expect(getFullCommandMap([])).toEqual(COMMAND_TO_QUERYTYPE_MAP)
    })

    it('does not mutate COMMAND_TO_QUERYTYPE_MAP', () => {
      const originalKeys = Object.keys(COMMAND_TO_QUERYTYPE_MAP)
      getFullCommandMap([{ alias: '/test', queryType: 'test' }])
      expect(Object.keys(COMMAND_TO_QUERYTYPE_MAP)).toEqual(originalKeys)
    })

    it('returns a new object instance on each call', () => {
      const map1 = getFullCommandMap()
      const map2 = getFullCommandMap()
      expect(map1).not.toBe(map2)
      expect(map1).toEqual(map2)
    })
  })

  describe('with dynamic aliases', () => {
    it('adds alias with explicit queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/myalias', queryType: 'custom' }]
      expect(getFullCommandMap(aliases)['/myalias']).toBe('custom')
    })

    it('derives queryType from alias name when not provided', () => {
      const aliases: DynamicAlias[] = [{ alias: '/research' }]
      expect(getFullCommandMap(aliases)['/research']).toBe('research')
    })

    it('adds multiple aliases and preserves all static commands', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/code', queryType: 'mcp:code' },
        { alias: '/qa', queryType: 'mcp:qa' },
      ]
      const map = getFullCommandMap(aliases)
      expect(map['/code']).toBe('mcp:code')
      expect(map['/qa']).toBe('mcp:qa')
      expect(map['/web']).toBe('web')
      expect(map['/chatgpt']).toBe('chat')
    })

    it('does not override static commands with dynamic aliases', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'override' }]
      expect(getFullCommandMap(aliases)['/web']).toBe('web')
    })

    it('ignores alias with empty string', () => {
      const aliases: DynamicAlias[] = [{ alias: '', queryType: 'empty' }]
      expect(getFullCommandMap(aliases)['']).toBeUndefined()
    })

    it('uses first occurrence when alias is duplicated', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/duplicate', queryType: 'first' },
        { alias: '/duplicate', queryType: 'second' },
      ]
      expect(getFullCommandMap(aliases)['/duplicate']).toBe('first')
    })

    it('handles alias with queryType that is empty string (falls back to derived)', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: '' }]
      expect(getFullCommandMap(aliases)['/test']).toBe('test')
    })

    it('handles alias with undefined queryType (falls back to derived)', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: undefined }]
      expect(getFullCommandMap(aliases)['/test']).toBe('test')
    })

    it('derives queryType by stripping leading slash', () => {
      const aliases: DynamicAlias[] = [{ alias: '/mycommand' }]
      expect(getFullCommandMap(aliases)['/mycommand']).toBe('mycommand')
    })

    it('handles alias without leading slash', () => {
      const aliases: DynamicAlias[] = [{ alias: 'noslash', queryType: 'custom' }]
      expect(getFullCommandMap(aliases)['noslash']).toBe('custom')
    })

    it('handles alias with special characters', () => {
      const aliases: DynamicAlias[] = [{ alias: '/c++', queryType: 'cpp' }]
      expect(getFullCommandMap(aliases)['/c++']).toBe('cpp')
    })

    it('handles alias with unicode', () => {
      const aliases: DynamicAlias[] = [{ alias: '/查询', queryType: 'search_cn' }]
      expect(getFullCommandMap(aliases)['/查询']).toBe('search_cn')
    })

    it('handles very long alias names', () => {
      const longAlias = '/' + 'a'.repeat(100)
      const aliases: DynamicAlias[] = [{ alias: longAlias, queryType: 'long' }]
      expect(getFullCommandMap(aliases)[longAlias]).toBe('long')
    })
  })
})

describe('getSupportedCommands - Command List Generation', () => {
  describe('static commands', () => {
    it('returns exactly the keys of COMMAND_TO_QUERYTYPE_MAP when no aliases provided', () => {
      const commands = getSupportedCommands()
      expect([...commands].sort()).toEqual(Object.keys(COMMAND_TO_QUERYTYPE_MAP).sort())
    })

    it('returns same result for no-arg, undefined, and empty-array calls', () => {
      expect(getSupportedCommands()).toEqual(getSupportedCommands(undefined))
      expect(getSupportedCommands()).toEqual(getSupportedCommands([]))
    })

    it('contains every key from COMMAND_TO_QUERYTYPE_MAP', () => {
      const commands = getSupportedCommands()
      for (const cmd of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
        expect(commands).toContain(cmd)
      }
    })

    it('has no duplicate entries', () => {
      const commands = getSupportedCommands()
      expect(commands.length).toBe(new Set(commands).size)
    })
  })

  describe('with dynamic aliases', () => {
    it('includes dynamic aliases alongside static commands', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/code', queryType: 'mcp:code' },
        { alias: '/qa', queryType: 'mcp:qa' },
      ]
      const commands = getSupportedCommands(aliases)
      expect(commands).toContain('/code')
      expect(commands).toContain('/qa')
      expect(commands).toContain('/web')
    })

    it('does not duplicate a command when alias shadows static', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'override' }]
      const commands = getSupportedCommands(aliases)
      expect(commands.filter(cmd => cmd === '/web').length).toBe(1)
    })

    it('has no duplicate entries when aliases are added', () => {
      const aliases: DynamicAlias[] = [{ alias: '/new1' }, { alias: '/new2' }]
      const commands = getSupportedCommands(aliases)
      expect(commands.length).toBe(new Set(commands).size)
    })
  })

  describe('consistency with getFullCommandMap', () => {
    it('returns exactly the keys of getFullCommandMap for any alias set', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test1', queryType: 'type1' }, { alias: '/test2' }]
      expect(getSupportedCommands(aliases)).toEqual(Object.keys(getFullCommandMap(aliases)))
    })
  })
})

describe('extractQueryTypeFromCommand - With Dynamic Aliases', () => {
  describe('dynamic alias resolution', () => {
    it('resolves dynamic alias to its queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
      expect(extractQueryTypeFromCommand('/code analyze this', aliases)).toBe('mcp:code')
    })

    it('resolves derived queryType from alias name', () => {
      const aliases: DynamicAlias[] = [{ alias: '/research' }]
      expect(extractQueryTypeFromCommand('/research query', aliases)).toBe('research')
    })

    it('prefers static command over dynamic alias when both exist', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'custom_web' }]
      expect(extractQueryTypeFromCommand('/web search', aliases)).toBe('web')
    })

    it('falls back to slash-stripping for unknown commands not in aliases', () => {
      const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known_type' }]
      expect(extractQueryTypeFromCommand('/unknown query', aliases)).toBe('unknown')
    })

    it('handles whitespace around dynamic alias command', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test_type' }]
      expect(extractQueryTypeFromCommand('  /test  query  ', aliases)).toBe('test_type')
    })
  })

  describe('static commands resolve identically regardless of alias list', () => {
    it('produces same result with no args, undefined, and empty array', () => {
      expect(extractQueryTypeFromCommand('/web search')).toBe('web')
      expect(extractQueryTypeFromCommand('/web search', undefined)).toBe('web')
      expect(extractQueryTypeFromCommand('/web search', [])).toBe('web')
    })

    it('default values are unaffected by alias presence', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test' }]
      expect(extractQueryTypeFromCommand('', aliases)).toBe('chat')
      expect(extractQueryTypeFromCommand(undefined, aliases)).toBe('chat')
    })
  })

  describe('alias precedence and shadowing', () => {
    it('static commands always win over any dynamic alias', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/web', queryType: 'custom1' },
        { alias: '/chatgpt', queryType: 'custom2' },
      ]
      expect(extractQueryTypeFromCommand('/web search', aliases)).toBe('web')
      expect(extractQueryTypeFromCommand('/chatgpt ask', aliases)).toBe('chat')
    })

    it('uses first alias when the same alias key is duplicated', () => {
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

  describe('queryType format preservation', () => {
    it.each([
      ['namespace:tool', 'namespace:tool'],
      ['my_custom_type', 'my_custom_type'],
      ['my-custom-type', 'my-custom-type'],
      ['ns:my_tool-v2', 'ns:my_tool-v2'],
      ['mcp:sub:tool', 'mcp:sub:tool'],
    ])('preserves queryType %s unchanged', (queryType, expected) => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType }]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe(expected)
    })
  })

  describe('alias naming patterns', () => {
    it.each([
      ['/my-tool', 'my-tool with dashes'],
      ['/my_tool', 'my_tool with underscores'],
      ['/MyTool', 'MyTool mixed case'],
      ['/tool2', 'tool2 with number'],
      ['/my-tool_v2', 'mixed separators'],
    ])('accepts %s as a valid alias key', alias => {
      const aliases: DynamicAlias[] = [{ alias, queryType: 'custom' }]
      expect(extractQueryTypeFromCommand(`${alias} execute`, aliases)).toBe('custom')
    })
  })

  describe('integration scenarios', () => {
    it('handles realistic MCP multi-alias workflow', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/code', queryType: 'mcp:claude_code' },
        { alias: '/qa', queryType: 'mcp:qa_testing' },
        { alias: '/research', queryType: 'mcp:research' },
      ]
      expect(extractQueryTypeFromCommand('/code fix the bug', aliases)).toBe('mcp:claude_code')
      expect(extractQueryTypeFromCommand('/qa run tests', aliases)).toBe('mcp:qa_testing')
      expect(extractQueryTypeFromCommand('/research query', aliases)).toBe('mcp:research')
      expect(extractQueryTypeFromCommand('/web search', aliases)).toBe('web')
    })
  })
})

describe('COMMAND_DESCRIPTIONS and COMMAND_TO_QUERYTYPE_MAP consistency', () => {
  it('both maps have identical key sets', () => {
    const mapKeys = new Set(Object.keys(COMMAND_TO_QUERYTYPE_MAP))
    const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS))
    expect(mapKeys).toEqual(descKeys)
  })

  it('each description value is a non-empty string', () => {
    for (const [cmd, description] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(typeof description, `${cmd} description should be a string`).toBe('string')
      expect(description.trim(), `${cmd} description should not be empty`).not.toBe('')
    }
  })
})
