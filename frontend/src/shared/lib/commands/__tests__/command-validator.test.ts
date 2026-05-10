import { describe, it, expect } from 'vitest'
import { hasValidCommand, canExecuteNode, isSlashCommand } from '../command-validator'
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

  describe('canExecuteNode', () => {
    describe('execution state gate', () => {
      it('returns false when isExecuting is true regardless of command', () => {
        expect(canExecuteNode('/chatgpt hello', true)).toBe(false)
        expect(canExecuteNode('/deleted-alias', true)).toBe(false)
        expect(canExecuteNode(null, true)).toBe(false)
      })
    })

    describe('slash format permissiveness', () => {
      it('returns true for a built-in command when not executing', () => {
        expect(canExecuteNode('/chatgpt hello', false)).toBe(true)
      })

      it('returns true for an unregistered slash alias when not executing', () => {
        expect(canExecuteNode('/deleted-alias prompt', false)).toBe(true)
        expect(canExecuteNode('/never-existed', false)).toBe(true)
      })

      it('returns true for a command with order prefix', () => {
        expect(canExecuteNode('#5 /steps task', false)).toBe(true)
        expect(canExecuteNode('#1 /deleted-alias prompt', false)).toBe(true)
      })

      it('returns true for command with leading whitespace', () => {
        expect(canExecuteNode('  /chatgpt  ', false)).toBe(true)
      })
    })

    describe('non-command input is always blocked', () => {
      it('returns false for empty string regardless of execution state', () => {
        expect(canExecuteNode('', false)).toBe(false)
        expect(canExecuteNode('', true)).toBe(false)
      })

      it('returns false for whitespace-only regardless of execution state', () => {
        expect(canExecuteNode('   ', false)).toBe(false)
        expect(canExecuteNode('   ', true)).toBe(false)
      })

      it('returns false for null regardless of execution state', () => {
        expect(canExecuteNode(null, false)).toBe(false)
        expect(canExecuteNode(null, true)).toBe(false)
      })

      it('returns false for undefined regardless of execution state', () => {
        expect(canExecuteNode(undefined, false)).toBe(false)
        expect(canExecuteNode(undefined, true)).toBe(false)
      })

      it('returns false for plain text regardless of execution state', () => {
        expect(canExecuteNode('plain text', false)).toBe(false)
        expect(canExecuteNode('plain text', true)).toBe(false)
      })
    })

    describe('algebraic identity with isSlashCommand', () => {
      it('canExecuteNode(x, false) equals isSlashCommand(x) for a representative set', () => {
        const inputs: Array<string | null | undefined> = [
          '/chatgpt hello',
          '/unknown',
          '#1 /tool',
          '',
          null,
          undefined,
          'text',
        ]
        inputs.forEach(x => {
          expect(canExecuteNode(x, false)).toBe(isSlashCommand(x))
        })
      })
    })
  })

  describe('validation algorithm completeness', () => {
    it('validates a representative sample of built-in commands', () => {
      const sample = ['/chatgpt', '/web', '/steps', '/foreach', '/claude', '/chat']
      sample.forEach(cmd => {
        expect(hasValidCommand(cmd)).toBe(true)
        expect(hasValidCommand(`${cmd} text`)).toBe(true)
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
        const aliases: DynamicAlias[] = [{ alias: '/\u67e5\u8be2', queryType: 'search_cn' }]
        expect(hasValidCommand('/\u67e5\u8be2 test', aliases)).toBe(true)
      })
    })
  })

  describe('isSlashCommand', () => {
    describe('valid slash commands', () => {
      it('returns true for a known built-in command', () => {
        expect(isSlashCommand('/web search')).toBe(true)
      })

      it('returns true for a dynamic alias not in the registry', () => {
        expect(isSlashCommand('/my-custom-alias prompt')).toBe(true)
      })

      it('returns true for a command with order prefix', () => {
        expect(isSlashCommand('#1 /tool run')).toBe(true)
      })

      it('returns true for a command with negative order prefix', () => {
        expect(isSlashCommand('#-3 /tool run')).toBe(true)
      })

      it('returns true for a command with no trailing text', () => {
        expect(isSlashCommand('/tool')).toBe(true)
      })

      it('returns true for a command with leading whitespace', () => {
        expect(isSlashCommand('   /tool')).toBe(true)
      })
    })

    describe('invalid inputs', () => {
      it('returns false for null', () => {
        expect(isSlashCommand(null)).toBe(false)
      })

      it('returns false for undefined', () => {
        expect(isSlashCommand(undefined)).toBe(false)
      })

      it('returns false for empty string', () => {
        expect(isSlashCommand('')).toBe(false)
      })

      it('returns false for plain text', () => {
        expect(isSlashCommand('just text')).toBe(false)
      })

      it('returns false for lone slash', () => {
        expect(isSlashCommand('/')).toBe(false)
      })

      it('returns false for slash with space before word', () => {
        expect(isSlashCommand('/ tool')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('returns true for digit-starting alias', () => {
        expect(isSlashCommand('/123')).toBe(true)
      })

      it('returns true for underscore-prefixed alias', () => {
        expect(isSlashCommand('/_tool')).toBe(true)
      })

      it('returns false when order number is not followed by whitespace before slash', () => {
        expect(isSlashCommand('#1/tool')).toBe(false)
      })

      it('returns true when order number is followed by multiple spaces before slash', () => {
        expect(isSlashCommand('#1  /tool')).toBe(true)
      })
    })
  })
})
