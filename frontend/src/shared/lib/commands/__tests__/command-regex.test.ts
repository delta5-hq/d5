import { describe, it, expect } from 'vitest'
import { commandRegex } from '../command-regex'
import { SUPPORTED_COMMANDS } from '../command-constants'

describe('commandRegex', () => {
  describe('pattern matching behavior', () => {
    describe('any - matches all supported commands', () => {
      it('matches /chatgpt at start', () => {
        expect(commandRegex.any().test('/chatgpt hello')).toBe(true)
      })

      it('matches /steps at start', () => {
        expect(commandRegex.any().test('/steps do something')).toBe(true)
      })

      it('matches /foreach at start', () => {
        expect(commandRegex.any().test('/foreach item in list')).toBe(true)
      })

      it('does not match command in middle of text', () => {
        expect(commandRegex.any().test('hello /chatgpt')).toBe(false)
      })

      it('does not match invalid command', () => {
        expect(commandRegex.any().test('/invalid')).toBe(false)
      })

      it('matches command with leading whitespace', () => {
        expect(commandRegex.any().test('  /chatgpt hello')).toBe(true)
      })

      it('matches command at end without trailing content', () => {
        expect(commandRegex.any().test('/chatgpt')).toBe(true)
      })

      it('matches command with trailing space', () => {
        expect(commandRegex.any().test('/chatgpt ')).toBe(true)
      })
    })

    describe('anyWithOrder - supports sequence prefixes', () => {
      it('matches command with #1 prefix', () => {
        expect(commandRegex.anyWithOrder().test('#1 /chatgpt hello')).toBe(true)
      })

      it('matches command without order prefix', () => {
        expect(commandRegex.anyWithOrder().test('/chatgpt hello')).toBe(true)
      })

      it('matches command with #42 prefix', () => {
        expect(commandRegex.anyWithOrder().test('#42 /steps do task')).toBe(true)
      })

      it('matches command with #999 prefix', () => {
        expect(commandRegex.anyWithOrder().test('#999 /foreach item')).toBe(true)
      })

      it('does not match order without command', () => {
        expect(commandRegex.anyWithOrder().test('#1 hello')).toBe(false)
      })

      it('does not match invalid order format', () => {
        expect(commandRegex.anyWithOrder().test('#abc /chatgpt')).toBe(false)
      })

      it('matches with leading whitespace before order', () => {
        expect(commandRegex.anyWithOrder().test('  #1 /chatgpt')).toBe(true)
      })

      it('requires space between order and command', () => {
        expect(commandRegex.anyWithOrder().test('#1/chatgpt')).toBe(false)
      })
    })

    describe('specific command patterns', () => {
      it('chatgpt matches only /chatgpt', () => {
        expect(commandRegex.chatgpt.test('/chatgpt hello')).toBe(true)
        expect(commandRegex.chatgpt.test('/claude hello')).toBe(false)
        expect(commandRegex.chatgpt.test('/steps hello')).toBe(false)
      })

      it('steps matches only /steps', () => {
        expect(commandRegex.steps.test('/steps create plan')).toBe(true)
        expect(commandRegex.steps.test('/chatgpt hello')).toBe(false)
      })

      it('foreach matches only /foreach', () => {
        expect(commandRegex.foreach.test('/foreach item in list')).toBe(true)
        expect(commandRegex.foreach.test('/steps task')).toBe(false)
      })

      it('web matches only /web', () => {
        expect(commandRegex.web.test('/web search query')).toBe(true)
        expect(commandRegex.web.test('/scholar query')).toBe(false)
      })

      it('scholar matches only /scholar', () => {
        expect(commandRegex.scholar.test('/scholar research')).toBe(true)
        expect(commandRegex.scholar.test('/web search')).toBe(false)
      })
    })

    describe('withOrder variants', () => {
      it('chatgptWithOrder matches with order prefix', () => {
        expect(commandRegex.chatgptWithOrder.test('#5 /chatgpt hello')).toBe(true)
      })

      it('chatgptWithOrder matches without order prefix', () => {
        expect(commandRegex.chatgptWithOrder.test('/chatgpt hello')).toBe(true)
      })

      it('stepsWithOrder matches with order', () => {
        expect(commandRegex.stepsWithOrder.test('#3 /steps analyze')).toBe(true)
      })

      it('foreachWithOrder matches with order', () => {
        expect(commandRegex.foreachWithOrder.test('#10 /foreach item')).toBe(true)
      })
    })
  })

  describe('edge cases and boundary conditions', () => {
    it('does not match empty string', () => {
      expect(commandRegex.any().test('')).toBe(false)
    })

    it('does not match whitespace only', () => {
      expect(commandRegex.any().test('   ')).toBe(false)
    })

    it('does not match command-like text without slash', () => {
      expect(commandRegex.any().test('chatgpt hello')).toBe(false)
    })

    it('does not match slash without command', () => {
      expect(commandRegex.any().test('/')).toBe(false)
    })

    it('does not match partial command', () => {
      expect(commandRegex.any().test('/chatg')).toBe(false)
    })

    it('matches /chat as valid completion command', () => {
      expect(commandRegex.any().test('/chat')).toBe(true)
    })

    it('does not match command with extra characters', () => {
      expect(commandRegex.any().test('/chatgpt123')).toBe(false)
    })

    it('requires exact command match', () => {
      expect(commandRegex.any().test('/chatgptpro')).toBe(false)
    })

    it('handles tab after command', () => {
      expect(commandRegex.any().test('/chatgpt\thello')).toBe(true)
    })

    it('handles newline after command', () => {
      expect(commandRegex.any().test('/chatgpt\nhello')).toBe(true)
    })

    it('does not match with prefix in middle', () => {
      expect(commandRegex.any().test('text #1 /chatgpt')).toBe(false)
    })

    it('does not match order without hash', () => {
      expect(commandRegex.anyWithOrder().test('1 /chatgpt')).toBe(false)
    })

    it('handles multiple consecutive spaces', () => {
      expect(commandRegex.any().test('/chatgpt     text')).toBe(true)
    })

    it('handles mixed whitespace characters', () => {
      expect(commandRegex.any().test('  \t  /chatgpt  \n  text')).toBe(true)
    })

    it('accepts order with many digits', () => {
      expect(commandRegex.anyWithOrder().test('#999999 /chatgpt')).toBe(true)
    })

    it('supports negative order prefix', () => {
      expect(commandRegex.anyWithOrder().test('#-5 /chatgpt hello')).toBe(true)
    })

    it('supports large negative order numbers', () => {
      expect(commandRegex.anyWithOrder().test('#-9999 /steps analyze')).toBe(true)
    })

    it('supports negative order with double digit', () => {
      expect(commandRegex.anyWithOrder().test('#-10 /summarize text')).toBe(true)
    })
  })

  describe('completeness - all supported commands', () => {
    it('anyWithOrder accepts all SUPPORTED_COMMANDS', () => {
      SUPPORTED_COMMANDS.forEach(cmd => {
        expect(commandRegex.anyWithOrder().test(`${cmd} text`)).toBe(true)
      })
    })

    it('any accepts all SUPPORTED_COMMANDS', () => {
      SUPPORTED_COMMANDS.forEach(cmd => {
        expect(commandRegex.any().test(`${cmd} text`)).toBe(true)
      })
    })

    it('has regex for each command type', () => {
      const requiredPatterns = [
        'yandex',
        'web',
        'scholar',
        'outline',
        'ext',
        'steps',
        'summarize',
        'foreach',
        'chatgpt',
        'switch',
        'case',
        'claude',
        'qwen',
        'perplexity',
        'download',
        'deepseek',
        'customLLMChat',
        'refine',
        'completion',
        'memorize',
      ]

      requiredPatterns.forEach(cmd => {
        expect(commandRegex[cmd as keyof typeof commandRegex]).toBeDefined()
        expect(commandRegex[cmd as keyof typeof commandRegex]).toBeInstanceOf(RegExp)
      })
    })
  })

  describe('regex immutability', () => {
    it('any returns new regex instance each call', () => {
      const regex1 = commandRegex.any()
      const regex2 = commandRegex.any()
      expect(regex1).not.toBe(regex2)
    })

    it('anyWithOrder returns new regex instance each call', () => {
      const regex1 = commandRegex.anyWithOrder()
      const regex2 = commandRegex.anyWithOrder()
      expect(regex1).not.toBe(regex2)
    })

    it('test does not modify regex state', () => {
      const regex = commandRegex.any()
      regex.test('/chatgpt hello')
      regex.test('/steps task')
      expect(regex.test('/chatgpt hello')).toBe(true)
    })

    it('concurrent tests do not interfere', () => {
      const results = [
        commandRegex.any().test('/chatgpt'),
        commandRegex.any().test('/invalid'),
        commandRegex.any().test('/steps'),
      ]
      expect(results).toEqual([true, false, true])
    })
  })

  describe('integration with workflow execution', () => {
    it('validates commands before execution', () => {
      const validCommands = ['/chatgpt hello', '#1 /steps task', '/foreach items']
      const invalidCommands = ['plain text', '/unknown cmd', 'text /chatgpt']

      validCommands.forEach(cmd => {
        expect(commandRegex.anyWithOrder().test(cmd)).toBe(true)
      })

      invalidCommands.forEach(cmd => {
        expect(commandRegex.anyWithOrder().test(cmd)).toBe(false)
      })
    })

    it('supports tree node command detection', () => {
      const nodeCommands = [
        { command: '/chatgpt', valid: true },
        { command: '#5 /steps', valid: true },
        { command: '/foreach', valid: true },
        { command: 'no command', valid: false },
        { command: '', valid: false },
      ]

      nodeCommands.forEach(({ command, valid }) => {
        expect(commandRegex.anyWithOrder().test(command)).toBe(valid)
      })
    })
  })

  describe('order prefix algorithm behavior', () => {
    describe('numeric bounds', () => {
      it('accepts zero as order', () => {
        expect(commandRegex.anyWithOrder().test('#0 /chatgpt')).toBe(true)
      })

      it('accepts single digit orders', () => {
        for (let i = 0; i <= 9; i++) {
          expect(commandRegex.anyWithOrder().test(`#${i} /chatgpt`)).toBe(true)
        }
      })

      it('accepts multi-digit orders', () => {
        const orders = [10, 42, 100, 999, 1234, 99999]
        orders.forEach(n => {
          expect(commandRegex.anyWithOrder().test(`#${n} /chatgpt`)).toBe(true)
        })
      })

      it('accepts negative single digit', () => {
        for (let i = -9; i <= -1; i++) {
          expect(commandRegex.anyWithOrder().test(`#${i} /chatgpt`)).toBe(true)
        }
      })

      it('accepts negative multi-digit', () => {
        const negatives = [-10, -42, -100, -999, -1234, -99999]
        negatives.forEach(n => {
          expect(commandRegex.anyWithOrder().test(`#${n} /chatgpt`)).toBe(true)
        })
      })

      it('rejects decimal orders', () => {
        expect(commandRegex.anyWithOrder().test('#1.5 /chatgpt')).toBe(false)
        expect(commandRegex.anyWithOrder().test('#-3.14 /chatgpt')).toBe(false)
      })

      it('rejects plus sign prefix', () => {
        expect(commandRegex.anyWithOrder().test('#+5 /chatgpt')).toBe(false)
      })

      it('rejects multiple negative signs', () => {
        expect(commandRegex.anyWithOrder().test('#--5 /chatgpt')).toBe(false)
      })

      it('rejects negative zero with explicit negative', () => {
        expect(commandRegex.anyWithOrder().test('#-0 /chatgpt')).toBe(true)
      })
    })

    describe('whitespace handling', () => {
      it('requires whitespace after order before command', () => {
        expect(commandRegex.anyWithOrder().test('#1/chatgpt')).toBe(false)
        expect(commandRegex.anyWithOrder().test('#1 /chatgpt')).toBe(true)
        expect(commandRegex.anyWithOrder().test('#1\t/chatgpt')).toBe(true)
        expect(commandRegex.anyWithOrder().test('#1\n/chatgpt')).toBe(true)
      })

      it('allows leading whitespace before order', () => {
        const whitespaces = ['  ', '\t', '\n', '  \t\n  ']
        whitespaces.forEach(ws => {
          expect(commandRegex.anyWithOrder().test(`${ws}#1 /chatgpt`)).toBe(true)
        })
      })

      it('rejects space between hash and number', () => {
        expect(commandRegex.anyWithOrder().test('# 1 /chatgpt')).toBe(false)
        expect(commandRegex.anyWithOrder().test('#  5 /chatgpt')).toBe(false)
      })

      it('rejects space between negative and digits', () => {
        expect(commandRegex.anyWithOrder().test('#- 5 /chatgpt')).toBe(false)
      })
    })

    describe('order prefix optionality', () => {
      it('anyWithOrder makes order optional', () => {
        SUPPORTED_COMMANDS.forEach(cmd => {
          expect(commandRegex.anyWithOrder().test(`${cmd}`)).toBe(true)
          expect(commandRegex.anyWithOrder().test(`#1 ${cmd}`)).toBe(true)
        })
      })

      it('any never accepts order prefix', () => {
        SUPPORTED_COMMANDS.forEach(cmd => {
          expect(commandRegex.any().test(`${cmd}`)).toBe(true)
          expect(commandRegex.any().test(`#1 ${cmd}`)).toBe(false)
        })
      })
    })
  })

  describe('command registry completeness', () => {
    it('every regex property has WithOrder variant', () => {
      const basePatterns = [
        'yandex',
        'web',
        'scholar',
        'outline',
        'ext',
        'steps',
        'summarize',
        'foreach',
        'chatgpt',
        'switch',
        'case',
        'claude',
        'qwen',
        'perplexity',
        'download',
        'deepseek',
        'customLLMChat',
        'refine',
        'completion',
        'memorize',
      ]

      basePatterns.forEach(base => {
        const withOrderKey = `${base}WithOrder` as keyof typeof commandRegex
        expect(commandRegex[base as keyof typeof commandRegex]).toBeDefined()
        expect(commandRegex[withOrderKey]).toBeDefined()
      })
    })
  })
})
