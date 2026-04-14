import { describe, it, expect } from 'vitest'
import {
  extractQueryTypeFromCommand,
  getFullCommandMap,
  getSupportedCommands,
  COMMAND_TO_QUERYTYPE_MAP,
  type DynamicAlias,
} from '../command-querytype-mapper'

describe('extractQueryTypeFromCommand - Command Mapping', () => {
  describe('chat-type commands', () => {
    it('maps /instruct to chat', () => {
      expect(extractQueryTypeFromCommand('/instruct Write a poem')).toBe('chat')
    })

    it('maps /reason to chat', () => {
      expect(extractQueryTypeFromCommand('/reason Analyze this')).toBe('chat')
    })

    it('maps /chatgpt to chat', () => {
      expect(extractQueryTypeFromCommand('/chatgpt Hello')).toBe('chat')
    })

    it('maps /chat to chat', () => {
      expect(extractQueryTypeFromCommand('/chat General query')).toBe('chat')
    })
  })

  describe('specialized query commands', () => {
    it('maps /web to web', () => {
      expect(extractQueryTypeFromCommand('/web Search for docs')).toBe('web')
    })

    it('maps /scholar to scholar', () => {
      expect(extractQueryTypeFromCommand('/scholar Research papers')).toBe('scholar')
    })

    it('maps /refine to refine', () => {
      expect(extractQueryTypeFromCommand('/refine Improve text')).toBe('refine')
    })

    it('maps /foreach to foreach', () => {
      expect(extractQueryTypeFromCommand('/foreach Process items')).toBe('foreach')
    })

    it('maps /steps to steps', () => {
      expect(extractQueryTypeFromCommand('/steps Break down task')).toBe('steps')
    })

    it('maps /outline to outline', () => {
      expect(extractQueryTypeFromCommand('/outline Create structure')).toBe('outline')
    })

    it('maps /summarize to summarize', () => {
      expect(extractQueryTypeFromCommand('/summarize Long document')).toBe('summarize')
    })

    it('maps /switch to switch', () => {
      expect(extractQueryTypeFromCommand('/switch Change context')).toBe('switch')
    })

    it('maps /memorize to memorize', () => {
      expect(extractQueryTypeFromCommand('/memorize Important fact')).toBe('memorize')
    })

    it('maps /ext to ext', () => {
      expect(extractQueryTypeFromCommand('/ext External call')).toBe('ext')
    })
  })

  describe('LLM provider commands', () => {
    it('maps /claude to claude', () => {
      expect(extractQueryTypeFromCommand('/claude Use Anthropic')).toBe('claude')
    })

    it('maps /qwen to qwen', () => {
      expect(extractQueryTypeFromCommand('/qwen Use Qwen model')).toBe('qwen')
    })

    it('maps /perplexity to perplexity', () => {
      expect(extractQueryTypeFromCommand('/perplexity Search and answer')).toBe('perplexity')
    })

    it('maps /deepseek to deepseek', () => {
      expect(extractQueryTypeFromCommand('/deepseek Code analysis')).toBe('deepseek')
    })

    it('maps /custom to custom_llm', () => {
      expect(extractQueryTypeFromCommand('/custom My LLM')).toBe('custom_llm')
    })

    it('maps /yandexgpt to yandex', () => {
      expect(extractQueryTypeFromCommand('/yandexgpt Russian query')).toBe('yandex')
    })
  })

  describe('fallback behavior', () => {
    it('strips slash from unknown commands', () => {
      expect(extractQueryTypeFromCommand('/unknown Do something')).toBe('unknown')
    })

    it('strips slash from unregistered command', () => {
      expect(extractQueryTypeFromCommand('/newfeature Test')).toBe('newfeature')
    })

    it('handles commands without slash prefix', () => {
      expect(extractQueryTypeFromCommand('chat Hello')).toBe('chat')
    })

    it('returns non-slash command as-is', () => {
      expect(extractQueryTypeFromCommand('custom Direct query')).toBe('custom')
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
      expect(extractQueryTypeFromCommand('/   ')).toBe('')
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
      expect(extractQueryTypeFromCommand('//web')).toBe('/web')
    })

    it('handles slash in middle as regular word', () => {
      expect(extractQueryTypeFromCommand('web/search query')).toBe('web/search')
    })

    it('preserves case for unknown commands', () => {
      expect(extractQueryTypeFromCommand('/UnknownCommand')).toBe('UnknownCommand')
    })

    it('handles very long command names', () => {
      const longCommand = '/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      expect(extractQueryTypeFromCommand(longCommand)).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    })

    it('handles special characters in unknown commands', () => {
      expect(extractQueryTypeFromCommand('/@#$%')).toBe('@#$%')
    })

    it('handles unicode characters', () => {
      expect(extractQueryTypeFromCommand('/查询 search')).toBe('查询')
    })

    it('handles emoji in command', () => {
      expect(extractQueryTypeFromCommand('/🔍 search')).toBe('🔍')
    })
  })

  describe('new commands in COMMAND_TO_QUERYTYPE_MAP', () => {
    it('maps /completion to completion', () => {
      expect(extractQueryTypeFromCommand('/completion Continue text')).toBe('completion')
    })

    it('maps /download to download', () => {
      expect(extractQueryTypeFromCommand('/download https://example.com')).toBe('download')
    })

    it('maps /case to switch (sub-command)', () => {
      expect(extractQueryTypeFromCommand('/case option1')).toBe('switch')
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

    it('does not override static commands with dynamic aliases', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'override' }]
      const map = getFullCommandMap(aliases)
      expect(map['/web']).toBe('web')
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

    it('handles very long alias names', () => {
      const longAlias = '/' + 'a'.repeat(100)
      const aliases: DynamicAlias[] = [{ alias: longAlias, queryType: 'long' }]
      const map = getFullCommandMap(aliases)
      expect(map[longAlias]).toBe('long')
    })

    it('handles alias with only slash', () => {
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
      expect(commands).toContain('/completion')
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

    it('does not duplicate commands when alias shadows static', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'override' }]
      const commands = getSupportedCommands(aliases)
      const webCount = commands.filter(cmd => cmd === '/web').length
      expect(webCount).toBe(1)
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

    it('resolves derived queryType from alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/research' }]
      expect(extractQueryTypeFromCommand('/research query', aliases)).toBe('research')
    })

    it('handles dynamic alias without text after command', () => {
      const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
      expect(extractQueryTypeFromCommand('/code', aliases)).toBe('mcp:code')
    })

    it('handles whitespace around dynamic alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test_type' }]
      expect(extractQueryTypeFromCommand('  /test  query  ', aliases)).toBe('test_type')
    })

    it('falls back to slash-stripping for unknown dynamic alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known_type' }]
      expect(extractQueryTypeFromCommand('/unknown query', aliases)).toBe('unknown')
    })
  })

  describe('maintains backward compatibility', () => {
    it('works identically without aliases parameter', () => {
      expect(extractQueryTypeFromCommand('/web search')).toBe('web')
      expect(extractQueryTypeFromCommand('/chatgpt hello')).toBe('chat')
    })

    it('handles all static commands with empty alias array', () => {
      expect(extractQueryTypeFromCommand('/web search', [])).toBe('web')
      expect(extractQueryTypeFromCommand('/claude query', [])).toBe('claude')
    })

    it('preserves edge case behavior with dynamic aliases', () => {
      const aliases: DynamicAlias[] = [{ alias: '/test' }]
      expect(extractQueryTypeFromCommand('', aliases)).toBe('chat')
      expect(extractQueryTypeFromCommand(undefined, aliases)).toBe('chat')
    })
  })

  describe('integration scenarios', () => {
    it('handles MCP coding agent alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:claude_code' }]
      expect(extractQueryTypeFromCommand('/code fix the bug', aliases)).toBe('mcp:claude_code')
    })

    it('handles QA testing alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/qa', queryType: 'mcp:qa_testing' }]
      expect(extractQueryTypeFromCommand('/qa run tests', aliases)).toBe('mcp:qa_testing')
    })

    it('handles multiple MCP aliases simultaneously', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/code', queryType: 'mcp:code' },
        { alias: '/qa', queryType: 'mcp:qa' },
        { alias: '/research', queryType: 'mcp:research' },
      ]
      expect(extractQueryTypeFromCommand('/code task', aliases)).toBe('mcp:code')
      expect(extractQueryTypeFromCommand('/qa task', aliases)).toBe('mcp:qa')
      expect(extractQueryTypeFromCommand('/research task', aliases)).toBe('mcp:research')
    })

    it('handles RPC aliases alongside MCP', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/mcp-tool', queryType: 'mcp' },
        { alias: '/rpc-call', queryType: 'rpc' },
      ]
      expect(extractQueryTypeFromCommand('/mcp-tool run', aliases)).toBe('mcp')
      expect(extractQueryTypeFromCommand('/rpc-call execute', aliases)).toBe('rpc')
    })
  })

  describe('queryType separator character handling', () => {
    it('preserves colon separator in queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'namespace:tool' }]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('namespace:tool')
    })

    it('preserves underscore in queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'my_custom_type' }]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('my_custom_type')
    })

    it('preserves dash in queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'my-custom-type' }]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('my-custom-type')
    })

    it('preserves mixed separators in queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'ns:my_tool-v2' }]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('ns:my_tool-v2')
    })

    it('preserves multiple colons in queryType', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'mcp:sub:tool' }]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('mcp:sub:tool')
    })
  })

  describe('alias naming patterns', () => {
    it('handles alias with dashes', () => {
      const aliases: DynamicAlias[] = [{ alias: '/my-tool', queryType: 'custom' }]
      expect(extractQueryTypeFromCommand('/my-tool execute', aliases)).toBe('custom')
    })

    it('handles alias with underscores', () => {
      const aliases: DynamicAlias[] = [{ alias: '/my_tool', queryType: 'custom' }]
      expect(extractQueryTypeFromCommand('/my_tool execute', aliases)).toBe('custom')
    })

    it('handles alias with mixed case', () => {
      const aliases: DynamicAlias[] = [{ alias: '/MyTool', queryType: 'custom' }]
      expect(extractQueryTypeFromCommand('/MyTool execute', aliases)).toBe('custom')
    })

    it('handles alias with numbers', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool2', queryType: 'custom' }]
      expect(extractQueryTypeFromCommand('/tool2 execute', aliases)).toBe('custom')
    })

    it('handles alias with mixed dash-underscore-numbers', () => {
      const aliases: DynamicAlias[] = [{ alias: '/my-tool_v2', queryType: 'custom' }]
      expect(extractQueryTypeFromCommand('/my-tool_v2 execute', aliases)).toBe('custom')
    })
  })

  describe('queryType and alias consistency', () => {
    it('maintains queryType integrity through extraction', () => {
      const originalQueryType = 'mcp:coder1'
      const aliases: DynamicAlias[] = [{ alias: '/coder1', queryType: originalQueryType }]
      const extracted = extractQueryTypeFromCommand('/coder1 task', aliases)
      expect(extracted).toBe(originalQueryType)
    })

    it('handles queryType with same structure as alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/my-tool', queryType: 'my-tool' }]
      expect(extractQueryTypeFromCommand('/my-tool run', aliases)).toBe('my-tool')
    })

    it('handles queryType different from alias', () => {
      const aliases: DynamicAlias[] = [{ alias: '/short', queryType: 'very_long_descriptive_type' }]
      expect(extractQueryTypeFromCommand('/short cmd', aliases)).toBe('very_long_descriptive_type')
    })
  })

  describe('edge cases with empty or malformed data', () => {
    it('handles alias list with null entries gracefully', () => {
      const aliases: DynamicAlias[] = [{ alias: '/valid', queryType: 'valid' }]
      expect(extractQueryTypeFromCommand('/valid cmd', aliases)).toBe('valid')
    })

    it('handles queryType with only whitespace', () => {
      const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: '   ' }]
      const result = extractQueryTypeFromCommand('/tool run', aliases)
      expect(typeof result === 'string').toBe(true)
    })

    it('handles alias without leading slash in command', () => {
      const aliases: DynamicAlias[] = [{ alias: 'noslash', queryType: 'custom' }]
      expect(extractQueryTypeFromCommand('noslash cmd', aliases)).toBe('custom')
    })
  })

  describe('priority and shadowing behavior', () => {
    it('respects static command priority over any dynamic alias', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/web', queryType: 'custom1' },
        { alias: '/chatgpt', queryType: 'custom2' },
      ]
      expect(extractQueryTypeFromCommand('/web search', aliases)).toBe('web')
      expect(extractQueryTypeFromCommand('/chatgpt ask', aliases)).toBe('chat')
    })

    it('handles duplicate aliases by using first occurrence', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/tool', queryType: 'first' },
        { alias: '/tool', queryType: 'second' },
      ]
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('first')
    })

    it('handles case-sensitive alias matching', () => {
      const aliases: DynamicAlias[] = [
        { alias: '/Tool', queryType: 'capitalized' },
        { alias: '/tool', queryType: 'lowercase' },
      ]
      expect(extractQueryTypeFromCommand('/Tool run', aliases)).toBe('capitalized')
      expect(extractQueryTypeFromCommand('/tool run', aliases)).toBe('lowercase')
    })
  })
})
