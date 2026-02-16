import { describe, it, expect } from 'vitest'
import { createCommandMatcher, matchesAnyCommand, matchesAnyCommandWithOrder, extractCommand } from '../command-matcher'

describe('command-matcher', () => {
  describe('createCommandMatcher', () => {
    it('creates standard matcher without order prefix', () => {
      const matcher = createCommandMatcher(['/chatgpt', '/web'])
      expect(matcher.standard.test('/chatgpt hello')).toBe(true)
      expect(matcher.standard.test('#1 /chatgpt hello')).toBe(false)
    })

    it('creates withOrder matcher that accepts order prefix', () => {
      const matcher = createCommandMatcher(['/chatgpt', '/web'])
      expect(matcher.withOrder.test('/chatgpt hello')).toBe(true)
      expect(matcher.withOrder.test('#1 /chatgpt hello')).toBe(true)
      expect(matcher.withOrder.test('#42 /web query')).toBe(true)
    })

    it('requires whitespace or EOL after command', () => {
      const matcher = createCommandMatcher(['/chatgpt'])
      expect(matcher.standard.test('/chatgpt')).toBe(true)
      expect(matcher.standard.test('/chatgpt hello')).toBe(true)
      expect(matcher.standard.test('/chatgpt123')).toBe(false)
    })

    it('matches at start of string only', () => {
      const matcher = createCommandMatcher(['/chatgpt'])
      expect(matcher.standard.test('/chatgpt hello')).toBe(true)
      expect(matcher.standard.test('text /chatgpt hello')).toBe(false)
    })

    it('handles negative step numbers', () => {
      const matcher = createCommandMatcher(['/chatgpt'])
      expect(matcher.withOrder.test('#-1 /chatgpt hello')).toBe(true)
    })
  })

  describe('matchesAnyCommand', () => {
    it('matches valid commands without order', () => {
      expect(matchesAnyCommand('/chatgpt hello')).toBe(true)
      expect(matchesAnyCommand('/instruct prompt')).toBe(true)
      expect(matchesAnyCommand('/steps task')).toBe(true)
    })

    it('rejects commands with order prefix', () => {
      expect(matchesAnyCommand('#1 /chatgpt hello')).toBe(false)
    })

    it('rejects invalid commands', () => {
      expect(matchesAnyCommand('/unknown')).toBe(false)
      expect(matchesAnyCommand('no command')).toBe(false)
      expect(matchesAnyCommand('')).toBe(false)
      expect(matchesAnyCommand(undefined)).toBe(false)
    })

    it('handles leading whitespace', () => {
      expect(matchesAnyCommand('  /chatgpt hello')).toBe(true)
    })
  })

  describe('matchesAnyCommandWithOrder', () => {
    it('matches commands with order prefix', () => {
      expect(matchesAnyCommandWithOrder('#1 /chatgpt hello')).toBe(true)
      expect(matchesAnyCommandWithOrder('#42 /steps task')).toBe(true)
    })

    it('matches commands without order prefix', () => {
      expect(matchesAnyCommandWithOrder('/chatgpt hello')).toBe(true)
      expect(matchesAnyCommandWithOrder('/steps task')).toBe(true)
    })

    it('rejects invalid commands', () => {
      expect(matchesAnyCommandWithOrder('#1 /unknown')).toBe(false)
      expect(matchesAnyCommandWithOrder('no command')).toBe(false)
    })
  })

  describe('extractCommand', () => {
    it('extracts command from text without order', () => {
      expect(extractCommand('/chatgpt hello')).toBe('/chatgpt')
      expect(extractCommand('/steps task')).toBe('/steps')
    })

    it('extracts command from text with order prefix', () => {
      expect(extractCommand('#1 /chatgpt hello')).toBe('/chatgpt')
      expect(extractCommand('#42 /steps task')).toBe('/steps')
    })

    it('returns null for invalid input', () => {
      expect(extractCommand('/unknown')).toBe(null)
      expect(extractCommand('no command')).toBe(null)
      expect(extractCommand('')).toBe(null)
      expect(extractCommand(undefined)).toBe(null)
    })

    it('handles leading whitespace', () => {
      expect(extractCommand('  /chatgpt hello')).toBe('/chatgpt')
      expect(extractCommand('  #1 /chatgpt hello')).toBe('/chatgpt')
    })
  })
})
