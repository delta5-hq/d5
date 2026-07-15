import { describe, it, expect } from 'vitest'
import { hasValidCommand, canExecuteNode, isSlashCommand } from '../command-validator'
import { COMMAND_TO_QUERYTYPE_MAP, type DynamicAlias } from '../../command-querytype-mapper'

describe('command-validator', () => {
  describe('hasValidCommand - validates command format', () => {
    describe('valid commands', () => {
      it('returns true for every registered command in COMMAND_TO_QUERYTYPE_MAP', () => {
        for (const cmd of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
          expect(hasValidCommand(cmd), `${cmd} should be valid`).toBe(true)
          expect(hasValidCommand(`${cmd} some text`), `${cmd} with text should be valid`).toBe(true)
        }
      })

      it('returns true for command with order prefix', () => {
        expect(hasValidCommand('#1 /steps do task')).toBe(true)
      })

      it('returns true for command with leading whitespace', () => {
        expect(hasValidCommand('  /chatgpt hello')).toBe(true)
      })

      it('returns true for command without trailing text', () => {
        expect(hasValidCommand('/chatgpt')).toBe(true)
      })

      it('returns true for command with negative order prefix', () => {
        expect(hasValidCommand('#-5 /chatgpt hello')).toBe(true)
      })

      describe('inline parameter transparency', () => {
        it.each([
          ['/validate :n=3 Must include revenue figures'],
          ['/validate :retry=5 Must include revenue figures'],
          ['/refine :n=3'],
          ['/refine :n=3 :fallback'],
        ])('returns true for %s', input => {
          expect(hasValidCommand(input)).toBe(true)
        })
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

      it('returns false for inline params attached without space', () => {
        expect(hasValidCommand('/validate:n=3')).toBe(false)
        expect(hasValidCommand('/refine:n=2')).toBe(false)
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
    })

    describe('non-command input is always blocked', () => {
      it('returns false for empty/whitespace/null/undefined/plain text regardless of state', () => {
        for (const state of [false, true]) {
          expect(canExecuteNode('', state)).toBe(false)
          expect(canExecuteNode('   ', state)).toBe(false)
          expect(canExecuteNode(null, state)).toBe(false)
          expect(canExecuteNode(undefined, state)).toBe(false)
          expect(canExecuteNode('plain text', state)).toBe(false)
        }
      })
    })

    describe('execution state logic', () => {
      it('execution state overrides valid command', () => {
        for (const cmd of Object.keys(COMMAND_TO_QUERYTYPE_MAP)) {
          expect(canExecuteNode(cmd, false)).toBe(true)
          expect(canExecuteNode(cmd, true)).toBe(false)
        }
      })

      it('invalid command stays invalid regardless of state', () => {
        for (const cmd of ['', null, undefined, 'text']) {
          expect(canExecuteNode(cmd, false)).toBe(false)
          expect(canExecuteNode(cmd, true)).toBe(false)
        }
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

    describe('consistency across calls (purity)', () => {
      it('same inputs always yield same outputs', () => {
        expect(hasValidCommand('/chatgpt hello')).toBe(hasValidCommand('/chatgpt hello'))
        expect(canExecuteNode('/chatgpt', false)).toBe(canExecuteNode('/chatgpt', false))
      })

      it('hasValidCommand result is independent of prior call history', () => {
        hasValidCommand('/chatgpt')
        hasValidCommand('invalid')
        expect(hasValidCommand('/chatgpt')).toBe(true)
      })
    })
  })

  describe('dynamic alias support (hasValidCommand)', () => {
    it('validates dynamic alias command with/without order prefix and text', () => {
      const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
      expect(hasValidCommand('/code test', aliases)).toBe(true)
      expect(hasValidCommand('#1 /code run', aliases)).toBe(true)
      expect(hasValidCommand('/code', aliases)).toBe(true)
      expect(hasValidCommand('  /code  ', aliases)).toBe(true)
    })

    it('rejects unknown command even with aliases provided', () => {
      const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known' }]
      expect(hasValidCommand('/unknown', aliases)).toBe(false)
    })

    it('validates a mix of static and dynamic commands', () => {
      const aliases: DynamicAlias[] = [{ alias: '/custom-tool', queryType: 'custom' }]
      expect(hasValidCommand('/web search', aliases)).toBe(true)
      expect(hasValidCommand('/custom-tool query', aliases)).toBe(true)
      expect(hasValidCommand('/chatgpt hello', aliases)).toBe(true)
    })

    it('static command takes precedence over dynamic alias with same name', () => {
      const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'custom_web' }]
      expect(hasValidCommand('/web', aliases)).toBe(true)
    })

    it('works with empty alias array and preserves backward compatibility', () => {
      expect(hasValidCommand('/web search', [])).toBe(true)
      expect(hasValidCommand('/web')).toBe(true)
      expect(hasValidCommand('invalid')).toBe(false)
    })

    it('handles special characters and unicode in dynamic aliases', () => {
      expect(hasValidCommand('/c++', [{ alias: '/c++', queryType: 'cpp' }])).toBe(true)
      expect(hasValidCommand('/查询 test', [{ alias: '/查询', queryType: 'search_cn' }])).toBe(true)
    })
  })

  describe('isSlashCommand', () => {
    describe('valid slash commands', () => {
      it('returns true for known, dynamic, prefixed, and bare slash commands', () => {
        expect(isSlashCommand('/web search')).toBe(true)
        expect(isSlashCommand('/my-custom-alias prompt')).toBe(true)
        expect(isSlashCommand('#1 /tool run')).toBe(true)
        expect(isSlashCommand('#-3 /tool run')).toBe(true)
        expect(isSlashCommand('/tool')).toBe(true)
        expect(isSlashCommand('   /tool')).toBe(true)
      })
    })

    describe('invalid inputs', () => {
      it('returns false for null/undefined/empty/plain/lone-slash/space-after-slash', () => {
        expect(isSlashCommand(null)).toBe(false)
        expect(isSlashCommand(undefined)).toBe(false)
        expect(isSlashCommand('')).toBe(false)
        expect(isSlashCommand('just text')).toBe(false)
        expect(isSlashCommand('/')).toBe(false)
        expect(isSlashCommand('/ tool')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('returns true for digit- and underscore-prefixed aliases', () => {
        expect(isSlashCommand('/123')).toBe(true)
        expect(isSlashCommand('/_tool')).toBe(true)
      })

      it('requires whitespace between order number and slash', () => {
        expect(isSlashCommand('#1/tool')).toBe(false)
        expect(isSlashCommand('#1  /tool')).toBe(true)
      })
    })
  })
})
