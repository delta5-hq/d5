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
  describe('registered command → queryType mapping', () => {
    it.each(BUILTIN_COMMANDS)('maps $alias to $queryType', ({ alias, queryType }) => {
      expect(extractQueryTypeFromCommand(`${alias} some prompt text`)).toBe(queryType)
    })

    it.each(BUILTIN_COMMANDS)('maps $alias with no trailing text', ({ alias, queryType }) => {
      expect(extractQueryTypeFromCommand(alias)).toBe(queryType)
    })

    it('returns the declared queryType for every registered command', () => {
      for (const [cmd, expectedType] of Object.entries(COMMAND_TO_QUERYTYPE_MAP)) {
        expect(extractQueryTypeFromCommand(cmd)).toBe(expectedType)
        expect(extractQueryTypeFromCommand(`${cmd} text`)).toBe(expectedType)
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
    it('maps unknown slash commands to explicit unknown query type', () => {
      expect(extractQueryTypeFromCommand('/unknown Do something')).toBe('unknown')
    })

    it('does not derive executable query types from unregistered slash commands', () => {
      expect(extractQueryTypeFromCommand('/newfeature Test')).toBe('unknown')
    })

    it('does not preserve unknown command text as an executable query type', () => {
      expect(extractQueryTypeFromCommand('/UnknownCommand')).toBe('unknown')
    })

    it('handles commands without slash prefix — defaults to chat', () => {
      expect(extractQueryTypeFromCommand('chat Hello')).toBe('chat')
      expect(extractQueryTypeFromCommand('custom Direct query')).toBe('chat')
    })

    it('returns chat for arbitrary generated text without slash prefix', () => {
      expect(extractQueryTypeFromCommand('Here is your outline:')).toBe('chat')
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

    it('handles command with only whitespace after slash', () => {
      expect(extractQueryTypeFromCommand('/   ')).toBe('unknown')
    })

    it('handles bare slash as unknown command', () => {
      expect(extractQueryTypeFromCommand('/')).toBe('unknown')
    })
  })

  describe('edge cases', () => {
    it('handles double slash as unknown command', () => {
      expect(extractQueryTypeFromCommand('//web')).toBe('unknown')
    })

    it('returns chat for input without leading slash even if it contains a slash mid-word', () => {
      expect(extractQueryTypeFromCommand('web/search query')).toBe('chat')
    })

    it('handles unicode characters in unknown commands', () => {
      expect(extractQueryTypeFromCommand('/查询 search')).toBe('unknown')
    })

    it('handles emoji in unknown command name', () => {
      expect(extractQueryTypeFromCommand('/🔍 search')).toBe('unknown')
    })

    it('handles very long unknown command names', () => {
      const longCommand = '/' + 'a'.repeat(100)
      expect(extractQueryTypeFromCommand(longCommand)).toBe('unknown')
    })

    it('handles special characters in unknown commands', () => {
      expect(extractQueryTypeFromCommand('/@#$%')).toBe('unknown')
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

    it.each(Object.entries(COMMAND_TO_QUERYTYPE_MAP))(
      'does not override static command %s with a dynamic alias',
      (alias, queryType) => {
        const aliases: DynamicAlias[] = [{ alias, queryType: 'override' }]
        const map = getFullCommandMap(aliases)
        expect(map[alias]).toBe(queryType)
      },
    )

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

    it('handles alias without leading slash', () => {
      const aliases: DynamicAlias[] = [{ alias: 'noslash', queryType: 'custom' }]
      expect(getFullCommandMap(aliases)['noslash']).toBe('custom')
    })
  })
})

describe('getSupportedCommands - Command List Generation', () => {
  it('returns exactly the keys of COMMAND_TO_QUERYTYPE_MAP when no aliases provided', () => {
    const commands = getSupportedCommands()
    expect([...commands].sort()).toEqual(Object.keys(COMMAND_TO_QUERYTYPE_MAP).sort())
  })

  it('contains every key from COMMAND_TO_QUERYTYPE_MAP', () => {
    const commands = getSupportedCommands()
    for (const cmd of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
      expect(commands).toContain(cmd)
    }
  })

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
})

describe('extractQueryTypeFromCommand - With Dynamic Aliases', () => {
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

  it('does not override static commands during query extraction (mcp-fusion)', () => {
    const aliases: DynamicAlias[] = [{ alias: '/mcp', queryType: 'override' }]
    expect(extractQueryTypeFromCommand('/mcp use every tool', aliases)).toBe('mcp-fusion')
  })

  it('returns unknown for a command absent from both static and dynamic registries', () => {
    const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known_type' }]
    expect(extractQueryTypeFromCommand('/unknown query', aliases)).toBe('unknown')
  })

  it('handles whitespace around dynamic alias command', () => {
    const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test_type' }]
    expect(extractQueryTypeFromCommand('  /test  query  ', aliases)).toBe('test_type')
  })

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

  it('each description value is a non-empty string', () => {
    for (const [cmd, description] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(typeof description, `${cmd} description should be a string`).toBe('string')
      expect(description.trim(), `${cmd} description should not be empty`).not.toBe('')
    }
  })
})
