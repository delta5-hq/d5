import { describe, it, expect } from 'vitest'
import { hasValidCommand, canExecuteNode } from '../command-validator'
import type { DynamicAlias } from '../../command-querytype-mapper'

describe('command-validator', () => {
  describe('hasValidCommand - validates command format', () => {
    describe('valid commands', () => {
      it('returns true for /chatgpt command', () => {
        expect(hasValidCommand('/chatgpt hello')).toBe(true)
      })

      it('returns true for command with order prefix', () => {
        expect(hasValidCommand('#1 /steps do task')).toBe(true)
      })

      it('returns true for /web command', () => {
        expect(hasValidCommand('/web search query')).toBe(true)
      })

      it('returns true for /foreach command', () => {
        expect(hasValidCommand('/foreach item in list')).toBe(true)
      })

      it('returns true for command with leading whitespace', () => {
        expect(hasValidCommand('  /chatgpt hello')).toBe(true)
      })

      it('returns true for command without trailing text', () => {
        expect(hasValidCommand('/chatgpt')).toBe(true)
      })

      it('returns true for command with large order number', () => {
        expect(hasValidCommand('#999 /steps')).toBe(true)
      })

      it('returns true for /claude command', () => {
        expect(hasValidCommand('/claude analyze')).toBe(true)
      })

      it('returns true for /deepseek command', () => {
        expect(hasValidCommand('/deepseek generate')).toBe(true)
      })

      it('returns true for /qwen command', () => {
        expect(hasValidCommand('/qwen prompt')).toBe(true)
      })

      it('returns true for /yandexgpt command', () => {
        expect(hasValidCommand('/yandexgpt question')).toBe(true)
      })

      it('returns true for /switch command', () => {
        expect(hasValidCommand('/switch option')).toBe(true)
      })

      it('returns true for /refine command', () => {
        expect(hasValidCommand('/refine text')).toBe(true)
      })

      it('returns true for /memorize command', () => {
        expect(hasValidCommand('/memorize content')).toBe(true)
      })

      it('returns true for /download command', () => {
        expect(hasValidCommand('/download url')).toBe(true)
      })

      it('returns true for command with negative order prefix', () => {
        expect(hasValidCommand('#-5 /chatgpt hello')).toBe(true)
      })

      it('returns true for large negative order number', () => {
        expect(hasValidCommand('#-9999 /steps analyze')).toBe(true)
      })
    })

    describe('invalid commands', () => {
      it('returns false for null', () => {
        expect(hasValidCommand(null)).toBe(false)
      })

      it('returns false for undefined', () => {
        expect(hasValidCommand(undefined)).toBe(false)
      })

      it('returns false for empty string', () => {
        expect(hasValidCommand('')).toBe(false)
      })

      it('returns false for whitespace only', () => {
        expect(hasValidCommand('   ')).toBe(false)
      })

      it('returns false for text without command', () => {
        expect(hasValidCommand('just plain text')).toBe(false)
      })

      it('returns false for command in middle of text', () => {
        expect(hasValidCommand('text /chatgpt hello')).toBe(false)
      })

      it('returns false for invalid command name', () => {
        expect(hasValidCommand('/invalid command')).toBe(false)
      })

      it('returns false for partial command', () => {
        expect(hasValidCommand('/chatg')).toBe(false)
      })

      it('returns false for command with extra characters', () => {
        expect(hasValidCommand('/chatgpt123')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('handles tabs and newlines', () => {
        expect(hasValidCommand('/chatgpt\t\nhello')).toBe(true)
      })

      it('handles mixed whitespace', () => {
        expect(hasValidCommand('  \t  /chatgpt  \n  text')).toBe(true)
      })

      it('returns false for only slash', () => {
        expect(hasValidCommand('/')).toBe(false)
      })

      it('returns false for order without command', () => {
        expect(hasValidCommand('#1 plain text')).toBe(false)
      })

      it('returns false for command-like without slash', () => {
        expect(hasValidCommand('chatgpt hello')).toBe(false)
      })
    })

    describe('trimming behavior', () => {
      it('trims leading spaces before validation', () => {
        expect(hasValidCommand('   /chatgpt')).toBe(true)
      })

      it('trims trailing spaces before validation', () => {
        expect(hasValidCommand('/chatgpt   ')).toBe(true)
      })

      it('handles multiple spaces in middle', () => {
        expect(hasValidCommand('/chatgpt     text')).toBe(true)
      })
    })
  })

  describe('canExecuteNode - combines command and execution state', () => {
    describe('execution allowed', () => {
      it('returns true when command valid and not executing', () => {
        expect(canExecuteNode('/chatgpt hello', false)).toBe(true)
      })

      it('returns true for command with order', () => {
        expect(canExecuteNode('#5 /steps task', false)).toBe(true)
      })

      it('returns true for minimal valid command', () => {
        expect(canExecuteNode('/web', false)).toBe(true)
      })
    })

    describe('execution blocked', () => {
      it('returns false when executing', () => {
        expect(canExecuteNode('/chatgpt hello', true)).toBe(false)
      })

      it('returns false when command invalid', () => {
        expect(canExecuteNode('plain text', false)).toBe(false)
      })

      it('returns false when command empty', () => {
        expect(canExecuteNode('', false)).toBe(false)
      })

      it('returns false when command null', () => {
        expect(canExecuteNode(null, false)).toBe(false)
      })

      it('returns false when command undefined', () => {
        expect(canExecuteNode(undefined, false)).toBe(false)
      })

      it('returns false when command null and executing', () => {
        expect(canExecuteNode(null, true)).toBe(false)
      })

      it('returns false when command valid but executing', () => {
        expect(canExecuteNode('/chatgpt hello', true)).toBe(false)
      })
    })

    describe('combined state validation', () => {
      it('requires both valid command and not executing', () => {
        expect(canExecuteNode('/chatgpt', false)).toBe(true)
        expect(canExecuteNode('/chatgpt', true)).toBe(false)
        expect(canExecuteNode('invalid', false)).toBe(false)
        expect(canExecuteNode('invalid', true)).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('handles whitespace-only command with not executing', () => {
        expect(canExecuteNode('   ', false)).toBe(false)
      })

      it('handles whitespace-only command while executing', () => {
        expect(canExecuteNode('   ', true)).toBe(false)
      })

      it('validates trimmed command', () => {
        expect(canExecuteNode('  /chatgpt  ', false)).toBe(true)
      })

      it('blocks trimmed valid command when executing', () => {
        expect(canExecuteNode('  /chatgpt  ', true)).toBe(false)
      })
    })
  })

  describe('consistency across calls', () => {
    it('returns same result for repeated calls with same input', () => {
      const command = '/chatgpt hello'
      const result1 = hasValidCommand(command)
      const result2 = hasValidCommand(command)
      const result3 = hasValidCommand(command)

      expect(result1).toBe(result2)
      expect(result2).toBe(result3)
    })

    it('maintains state independence between calls', () => {
      hasValidCommand('/chatgpt')
      hasValidCommand('invalid')
      const result = hasValidCommand('/chatgpt')

      expect(result).toBe(true)
    })

    it('canExecuteNode produces consistent results', () => {
      const result1 = canExecuteNode('/chatgpt', false)
      const result2 = canExecuteNode('/chatgpt', false)

      expect(result1).toBe(result2)
      expect(result1).toBe(true)
    })
  })

  describe('validation algorithm completeness', () => {
    describe('all supported commands validate', () => {
      it('validates all backend-supported commands', () => {
        const backendCommands = [
          '/yandexgpt',
          '/web',
          '/scholar',
          '/outline',
          '/ext',
          '/steps',
          '/summarize',
          '/foreach',
          '/chatgpt',
          '/switch',
          '/case',
          '/claude',
          '/qwen',
          '/perplexity',
          '/download',
          '/deepseek',
          '/custom',
          '/refine',
          '/chat',
          '/memorize',
        ]

        backendCommands.forEach(cmd => {
          expect(hasValidCommand(cmd)).toBe(true)
          expect(hasValidCommand(`${cmd} text`)).toBe(true)
          expect(hasValidCommand(`#1 ${cmd}`)).toBe(true)
        })
      })

      it('validates commands regardless of order prefix', () => {
        const commands = ['/chatgpt', '/web', '/steps', '/foreach']

        commands.forEach(cmd => {
          expect(hasValidCommand(cmd)).toBe(true)
          expect(hasValidCommand(`#1 ${cmd}`)).toBe(true)
          expect(hasValidCommand(`#-5 ${cmd}`)).toBe(true)
          expect(hasValidCommand(`#999 ${cmd}`)).toBe(true)
        })
      })
    })
  })

  describe('execution state logic', () => {
    describe('state transitions', () => {
      it('blocks execution during execution', () => {
        expect(canExecuteNode('/chatgpt', true)).toBe(false)
        expect(canExecuteNode('/chatgpt', false)).toBe(true)
      })

      it('execution state overrides valid command', () => {
        const validCommands = ['/chatgpt', '/web', '/steps', '#1 /foreach']

        validCommands.forEach(cmd => {
          expect(canExecuteNode(cmd, false)).toBe(true)
          expect(canExecuteNode(cmd, true)).toBe(false)
        })
      })

      it('invalid command stays invalid regardless of state', () => {
        const invalidCommands = ['', null, undefined, 'text', '/invalid']

        invalidCommands.forEach(cmd => {
          expect(canExecuteNode(cmd, false)).toBe(false)
          expect(canExecuteNode(cmd, true)).toBe(false)
        })
      })
    })
  })

  describe('normalization behavior', () => {
    it('normalizes input before validation', () => {
      const inputs = [
        { raw: '  /chatgpt  ', normalized: '/chatgpt' },
        { raw: '\t/web\n', normalized: '/web' },
        { raw: '   #1 /steps   ', normalized: '#1 /steps' },
      ]

      inputs.forEach(({ raw, normalized }) => {
        const rawResult = hasValidCommand(raw)
        const normalizedResult = hasValidCommand(normalized)
        expect(rawResult).toBe(normalizedResult)
        expect(rawResult).toBe(true)
      })
    })
  })

  describe('boundary value analysis', () => {
    describe('string length boundaries', () => {
      it('accepts command with very long text', () => {
        const longText = 'a'.repeat(10000)
        expect(hasValidCommand(`/chatgpt ${longText}`)).toBe(true)
      })

      it('accepts command with order and long text', () => {
        const longText = 'a'.repeat(10000)
        expect(hasValidCommand(`#999 /chatgpt ${longText}`)).toBe(true)
      })
    })

    describe('order number boundaries', () => {
      it('validates order range extremes', () => {
        expect(hasValidCommand('#0 /chatgpt')).toBe(true)
        expect(hasValidCommand('#999999999 /chatgpt')).toBe(true)
        expect(hasValidCommand('#-999999999 /chatgpt')).toBe(true)
      })
    })
  })

  describe('dynamic alias support', () => {
    describe('single dynamic alias', () => {
      it('validates dynamic alias command', () => {
        const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
        expect(hasValidCommand('/code test', aliases)).toBe(true)
      })

      it('validates dynamic alias with order prefix', () => {
        const aliases: DynamicAlias[] = [{ alias: '/qa', queryType: 'mcp:qa' }]
        expect(hasValidCommand('#1 /qa run tests', aliases)).toBe(true)
      })

      it('validates dynamic alias without text', () => {
        const aliases: DynamicAlias[] = [{ alias: '/custom', queryType: 'custom_type' }]
        expect(hasValidCommand('/custom', aliases)).toBe(true)
      })

      it('validates dynamic alias with whitespace', () => {
        const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test' }]
        expect(hasValidCommand('  /test  ', aliases)).toBe(true)
      })

      it('rejects unknown command even with aliases provided', () => {
        const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known' }]
        expect(hasValidCommand('/unknown', aliases)).toBe(false)
      })
    })

    describe('multiple dynamic aliases', () => {
      it('validates all provided dynamic aliases', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/code', queryType: 'mcp:code' },
          { alias: '/qa', queryType: 'mcp:qa' },
          { alias: '/research', queryType: 'mcp:research' },
        ]
        expect(hasValidCommand('/code task', aliases)).toBe(true)
        expect(hasValidCommand('/qa task', aliases)).toBe(true)
        expect(hasValidCommand('/research task', aliases)).toBe(true)
      })

      it('validates mix of static and dynamic commands', () => {
        const aliases: DynamicAlias[] = [{ alias: '/custom', queryType: 'custom' }]
        expect(hasValidCommand('/web search', aliases)).toBe(true)
        expect(hasValidCommand('/custom query', aliases)).toBe(true)
        expect(hasValidCommand('/chatgpt hello', aliases)).toBe(true)
      })

      it('validates dynamic aliases with order prefixes', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/a', queryType: 'alias_a' },
          { alias: '/b', queryType: 'alias_b' },
        ]
        expect(hasValidCommand('#1 /a', aliases)).toBe(true)
        expect(hasValidCommand('#2 /b', aliases)).toBe(true)
      })
    })

    describe('dynamic alias precedence', () => {
      it('static command takes precedence over dynamic with same alias', () => {
        const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'custom_web' }]
        expect(hasValidCommand('/web', aliases)).toBe(true)
      })

      it('validates both static and non-conflicting dynamic', () => {
        const aliases: DynamicAlias[] = [{ alias: '/custom', queryType: 'custom' }]
        expect(hasValidCommand('/web', aliases)).toBe(true)
        expect(hasValidCommand('/custom', aliases)).toBe(true)
      })
    })

    describe('empty or invalid alias arrays', () => {
      it('works with empty alias array', () => {
        expect(hasValidCommand('/web search', [])).toBe(true)
        expect(hasValidCommand('/chatgpt hello', [])).toBe(true)
      })

      it('handles aliases with empty alias string', () => {
        const aliases: DynamicAlias[] = [{ alias: '', queryType: 'empty' }]
        expect(hasValidCommand('/web', aliases)).toBe(true)
      })

      it('handles aliases with undefined queryType', () => {
        const aliases: DynamicAlias[] = [{ alias: '/test', queryType: undefined }]
        expect(hasValidCommand('/test', aliases)).toBe(true)
      })
    })

    describe('backward compatibility', () => {
      it('maintains behavior when no aliases parameter provided', () => {
        expect(hasValidCommand('/web')).toBe(true)
        expect(hasValidCommand('/chatgpt hello')).toBe(true)
        expect(hasValidCommand('invalid')).toBe(false)
      })

      it('null/undefined values work same as before', () => {
        expect(hasValidCommand(null, [])).toBe(false)
        expect(hasValidCommand(undefined, [])).toBe(false)
        expect(hasValidCommand('', [])).toBe(false)
      })
    })

    describe('integration scenarios', () => {
      it('validates MCP coding agent workflow', () => {
        const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:claude_code' }]
        expect(hasValidCommand('/code fix the bug', aliases)).toBe(true)
        expect(hasValidCommand('#1 /code refactor', aliases)).toBe(true)
      })

      it('validates QA testing workflow', () => {
        const aliases: DynamicAlias[] = [{ alias: '/qa', queryType: 'mcp:qa' }]
        expect(hasValidCommand('/qa run all tests', aliases)).toBe(true)
        expect(hasValidCommand('#5 /qa verify login', aliases)).toBe(true)
      })

      it('validates combined MCP and static workflow', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/code', queryType: 'mcp:code' },
          { alias: '/qa', queryType: 'mcp:qa' },
        ]
        expect(hasValidCommand('#1 /web research API', aliases)).toBe(true)
        expect(hasValidCommand('#2 /code implement feature', aliases)).toBe(true)
        expect(hasValidCommand('#3 /qa test feature', aliases)).toBe(true)
      })
    })

    describe('edge cases with dynamic aliases', () => {
      it('handles very long dynamic alias names', () => {
        const longAlias = '/' + 'a'.repeat(100)
        const aliases: DynamicAlias[] = [{ alias: longAlias, queryType: 'long' }]
        expect(hasValidCommand(longAlias, aliases)).toBe(true)
      })

      it('handles special characters in dynamic alias', () => {
        const aliases: DynamicAlias[] = [{ alias: '/c++', queryType: 'cpp' }]
        expect(hasValidCommand('/c++', aliases)).toBe(true)
      })

      it('handles unicode in dynamic alias', () => {
        const aliases: DynamicAlias[] = [{ alias: '/查询', queryType: 'search_cn' }]
        expect(hasValidCommand('/查询 test', aliases)).toBe(true)
      })
    })
  })

  describe('canExecuteNode with dynamic aliases', () => {
    describe('execution state with dynamic aliases', () => {
      it('respects execution state for dynamic aliases', () => {
        const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
        expect(canExecuteNode('/code task', false, aliases)).toBe(true)
        expect(canExecuteNode('/code task', true, aliases)).toBe(false)
      })

      it('validates multiple dynamic aliases with execution state', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/a', queryType: 'alias_a' },
          { alias: '/b', queryType: 'alias_b' },
        ]
        expect(canExecuteNode('/a', false, aliases)).toBe(true)
        expect(canExecuteNode('/b', false, aliases)).toBe(true)
        expect(canExecuteNode('/a', true, aliases)).toBe(false)
        expect(canExecuteNode('/b', true, aliases)).toBe(false)
      })

      it('maintains same behavior for static commands with aliases', () => {
        const aliases: DynamicAlias[] = [{ alias: '/custom', queryType: 'custom' }]
        expect(canExecuteNode('/web', false, aliases)).toBe(true)
        expect(canExecuteNode('/web', true, aliases)).toBe(false)
      })
    })

    describe('backward compatibility for canExecuteNode', () => {
      it('works without aliases parameter', () => {
        expect(canExecuteNode('/web', false)).toBe(true)
        expect(canExecuteNode('/web', true)).toBe(false)
      })

      it('works with empty alias array', () => {
        expect(canExecuteNode('/web', false, [])).toBe(true)
        expect(canExecuteNode('/web', true, [])).toBe(false)
      })
    })

    describe('alias naming pattern validation', () => {
      it('validates aliases with dashes', () => {
        const aliases: DynamicAlias[] = [{ alias: '/my-tool', queryType: 'custom' }]
        expect(hasValidCommand('/my-tool execute', aliases)).toBe(true)
        expect(canExecuteNode('/my-tool', false, aliases)).toBe(true)
      })

      it('validates aliases with underscores', () => {
        const aliases: DynamicAlias[] = [{ alias: '/my_tool', queryType: 'custom' }]
        expect(hasValidCommand('/my_tool execute', aliases)).toBe(true)
        expect(canExecuteNode('/my_tool', false, aliases)).toBe(true)
      })

      it('validates aliases with mixed separators', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool-v2_beta', queryType: 'custom' }]
        expect(hasValidCommand('/tool-v2_beta run', aliases)).toBe(true)
      })

      it('validates aliases with numbers', () => {
        const aliases: DynamicAlias[] = [{ alias: '/agent007', queryType: 'custom' }]
        expect(hasValidCommand('/agent007 execute', aliases)).toBe(true)
      })

      it('handles case sensitivity in aliases', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/Tool', queryType: 'upper' },
          { alias: '/tool', queryType: 'lower' },
        ]
        expect(hasValidCommand('/Tool run', aliases)).toBe(true)
        expect(hasValidCommand('/tool run', aliases)).toBe(true)
      })
    })

    describe('queryType format independence', () => {
      it('validates command regardless of queryType separator', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/a', queryType: 'ns:tool' },
          { alias: '/b', queryType: 'my_type' },
          { alias: '/c', queryType: 'my-type' },
        ]
        expect(hasValidCommand('/a cmd', aliases)).toBe(true)
        expect(hasValidCommand('/b cmd', aliases)).toBe(true)
        expect(hasValidCommand('/c cmd', aliases)).toBe(true)
      })

      it('validates with complex queryType patterns', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'mcp:sub:namespace:tool' }]
        expect(hasValidCommand('/tool execute', aliases)).toBe(true)
        expect(canExecuteNode('/tool execute', false, aliases)).toBe(true)
      })
    })

    describe('robustness validation', () => {
      it('handles whitespace variations', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'custom' }]
        expect(hasValidCommand('  /tool  cmd  ', aliases)).toBe(true)
        expect(hasValidCommand('\t/tool\tcmd', aliases)).toBe(true)
      })

      it('handles order prefixes with dynamic aliases', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'custom' }]
        expect(hasValidCommand('#1 /tool cmd', aliases)).toBe(true)
        expect(hasValidCommand('#999 /tool', aliases)).toBe(true)
      })

      it('rejects invalid commands even with aliases present', () => {
        const aliases: DynamicAlias[] = [{ alias: '/valid', queryType: 'custom' }]
        expect(hasValidCommand('no command', aliases)).toBe(false)
        expect(hasValidCommand('/invalid', aliases)).toBe(false)
      })

      it('handles edge case inputs gracefully', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'custom' }]
        expect(hasValidCommand('', aliases)).toBe(false)
        expect(hasValidCommand('   ', aliases)).toBe(false)
        expect(canExecuteNode('', false, aliases)).toBe(false)
      })
    })
  })
})
