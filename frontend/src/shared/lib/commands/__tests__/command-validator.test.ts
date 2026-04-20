import { describe, it, expect } from 'vitest'
import { hasValidCommand, canExecuteNode } from '../command-validator'

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
})
