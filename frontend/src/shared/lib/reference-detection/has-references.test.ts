import { describe, it, expect } from 'vitest'
import { hasReferencesInText, hasReferencesInAny } from './has-references'

describe('hasReferencesInText', () => {
  describe('@@ reference patterns', () => {
    it.each([
      ['@@ref', true],
      ['text @@ref text', true],
      ['@@first @@second', true],
      ['@@_underscore', true],
      ['@@CamelCase', true],
      ['@@123numbers', true],
      ['start@@ref', true],
      ['@@ref end', true],
    ] as const)('%s → %s', (input, expected) => {
      expect(hasReferencesInText(input)).toBe(expected)
    })
  })

  describe('## reference patterns', () => {
    it.each([
      ['##_var', true],
      ['text ##_var text', true],
      ['##plain', true],
      ['##_first ##_second', true],
      ['##_CamelCase', true],
      ['##_123', true],
    ] as const)('%s → %s', (input, expected) => {
      expect(hasReferencesInText(input)).toBe(expected)
    })
  })

  describe('mixed reference patterns', () => {
    it.each([
      ['@@ref and ##_var', true],
      ['##_var then @@ref', true],
      ['@@a @@b ##_c ##_d', true],
    ] as const)('%s → %s', (input, expected) => {
      expect(hasReferencesInText(input)).toBe(expected)
    })
  })

  describe('false positive prevention', () => {
    it.each([
      ['email@@domain.com', true],
      ['user@email.com', false],
      ['# heading', false],
      ['#hashtag', false],
      ['/chatgpt summarize', false],
      ['plain text', false],
      ['123 numbers', false],
      ['special!@#$%', false],
    ] as const)('%s → %s', (input, expected) => {
      expect(hasReferencesInText(input)).toBe(expected)
    })

    it('detects ## at start (markdown h2 also valid reference)', () => {
      expect(hasReferencesInText('## heading')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it.each([
      ['', false],
      [' ', false],
      ['   ', false],
      ['\t', false],
      ['\n', false],
      [undefined, false],
      ['@@', true],
      ['##', true],
      ['@@@triple', true],
      ['###triple', true],
    ] as const)('%j → %s', (input, expected) => {
      expect(hasReferencesInText(input as string | undefined)).toBe(expected)
    })
  })

  describe('whitespace handling', () => {
    it.each([
      ['  @@ref  ', true],
      ['\t@@ref\t', true],
      ['\n@@ref\n', true],
      ['  ##_var  ', true],
      ['@@ref\n##_var', true],
    ] as const)('%j → %s', (input, expected) => {
      expect(hasReferencesInText(input)).toBe(expected)
    })
  })
})

describe('hasReferencesInAny', () => {
  describe('single input scenarios', () => {
    it('returns false for single plain text', () => {
      expect(hasReferencesInAny('plain text')).toBe(false)
    })

    it('returns true for single text with reference', () => {
      expect(hasReferencesInAny('@@ref')).toBe(true)
    })

    it('returns false for single undefined', () => {
      expect(hasReferencesInAny(undefined)).toBe(false)
    })

    it('returns false for single empty string', () => {
      expect(hasReferencesInAny('')).toBe(false)
    })
  })

  describe('multiple input scenarios', () => {
    it('returns false when all inputs are plain', () => {
      expect(hasReferencesInAny('plain', 'text', 'here')).toBe(false)
    })

    it('returns true when first input has references', () => {
      expect(hasReferencesInAny('@@ref', 'plain')).toBe(true)
    })

    it('returns true when last input has references', () => {
      expect(hasReferencesInAny('plain', 'text', '##_var')).toBe(true)
    })

    it('returns true when middle input has references', () => {
      expect(hasReferencesInAny('plain', '@@ref', 'text')).toBe(true)
    })

    it('returns true when multiple inputs have references', () => {
      expect(hasReferencesInAny('@@ref1', '##_var', '@@ref2')).toBe(true)
    })
  })

  describe('undefined handling', () => {
    it('ignores undefined in first position', () => {
      expect(hasReferencesInAny(undefined, 'plain')).toBe(false)
    })

    it('ignores undefined in last position', () => {
      expect(hasReferencesInAny('plain', undefined)).toBe(false)
    })

    it('finds reference despite undefined values', () => {
      expect(hasReferencesInAny(undefined, '@@ref', undefined)).toBe(true)
    })

    it('handles all undefined inputs', () => {
      expect(hasReferencesInAny(undefined, undefined, undefined)).toBe(false)
    })
  })

  describe('empty input scenarios', () => {
    it('returns false for no arguments', () => {
      expect(hasReferencesInAny()).toBe(false)
    })

    it('handles mix of empty strings and plain text', () => {
      expect(hasReferencesInAny('', 'plain', '')).toBe(false)
    })

    it('finds reference in mix of empty strings', () => {
      expect(hasReferencesInAny('', '@@ref', '')).toBe(true)
    })
  })

  describe('real-world node scenarios', () => {
    it('detects refs in command with plain title', () => {
      const command = 'use @@myRef here'
      const title = 'Plain Title'
      expect(hasReferencesInAny(command, title)).toBe(true)
    })

    it('detects refs in title with plain command', () => {
      const command = 'plain command'
      const title = 'Result from @@parent'
      expect(hasReferencesInAny(command, title)).toBe(true)
    })

    it('detects refs when both have references', () => {
      const command = '@@cmdRef'
      const title = '##_titleVar'
      expect(hasReferencesInAny(command, title)).toBe(true)
    })

    it('returns false when neither has references', () => {
      const command = 'plain command'
      const title = 'plain title'
      expect(hasReferencesInAny(command, title)).toBe(false)
    })

    it('handles prompt node with empty command', () => {
      const command = undefined
      const title = 'Generated result with @@ref'
      expect(hasReferencesInAny(command, title)).toBe(true)
    })

    it('handles empty prompt node', () => {
      const command = undefined
      const title = undefined
      expect(hasReferencesInAny(command, title)).toBe(false)
    })
  })
})
