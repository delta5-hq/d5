import { describe, it, expect } from 'vitest'
import { clearSequencePrefix, hasSequencePrefix, extractSequenceNumber } from '../command-patterns'

describe('command-patterns', () => {
  describe('clearSequencePrefix', () => {
    describe('basic removal', () => {
      it('removes positive step prefix', () => {
        expect(clearSequencePrefix('#1 /chatgpt hello')).toBe('/chatgpt hello')
        expect(clearSequencePrefix('#42 content here')).toBe('content here')
        expect(clearSequencePrefix('#999 large number')).toBe('large number')
      })

      it('removes negative step prefix', () => {
        expect(clearSequencePrefix('#-1 negative')).toBe('negative')
        expect(clearSequencePrefix('#-42 more negative')).toBe('more negative')
      })

      it('removes zero step prefix', () => {
        expect(clearSequencePrefix('#0 zero step')).toBe('zero step')
      })
    })

    describe('text without prefix', () => {
      it('preserves text without step prefix', () => {
        expect(clearSequencePrefix('/chatgpt hello')).toBe('/chatgpt hello')
        expect(clearSequencePrefix('no prefix here')).toBe('no prefix here')
        expect(clearSequencePrefix('')).toBe('')
      })

      it('preserves hash symbols not followed by numbers', () => {
        expect(clearSequencePrefix('#hashtag text')).toBe('#hashtag text')
        expect(clearSequencePrefix('# not a number')).toBe('# not a number')
      })
    })

    describe('multiple prefixes', () => {
      it('removes all step prefixes in text', () => {
        expect(clearSequencePrefix('#1 text #2 more')).toBe('text  more')
        expect(clearSequencePrefix('#1 #2 #3 multiple')).toBe('multiple')
      })
    })

    describe('whitespace handling', () => {
      it('trims leading and trailing whitespace', () => {
        expect(clearSequencePrefix('  #1 text  ')).toBe('text')
        expect(clearSequencePrefix('\t#1 text\n')).toBe('text')
      })

      it('preserves internal whitespace', () => {
        expect(clearSequencePrefix('#1 text  with  spaces')).toBe('text  with  spaces')
      })
    })

    describe('edge cases', () => {
      it('handles prefix at end of text', () => {
        expect(clearSequencePrefix('text #1')).toBe('text')
      })

      it('handles prefix in middle of text', () => {
        expect(clearSequencePrefix('before #1 after')).toBe('before  after')
      })

      it('handles very large numbers', () => {
        expect(clearSequencePrefix('#99999999 text')).toBe('text')
      })

      it('handles single character after removal', () => {
        expect(clearSequencePrefix('#1 a')).toBe('a')
      })
    })
  })

  describe('hasSequencePrefix', () => {
    describe('positive detection', () => {
      it('detects standard step prefixes', () => {
        expect(hasSequencePrefix('#1 text')).toBe(true)
        expect(hasSequencePrefix('#999 text')).toBe(true)
      })

      it('detects negative step prefixes', () => {
        expect(hasSequencePrefix('#-1 text')).toBe(true)
        expect(hasSequencePrefix('#-999 text')).toBe(true)
      })

      it('detects zero step prefix', () => {
        expect(hasSequencePrefix('#0 text')).toBe(true)
      })

      it('detects prefix with leading whitespace', () => {
        expect(hasSequencePrefix('  #1 text')).toBe(true)
        expect(hasSequencePrefix('\t#1 text')).toBe(true)
      })
    })

    describe('negative detection', () => {
      it('rejects text without prefix', () => {
        expect(hasSequencePrefix('text')).toBe(false)
        expect(hasSequencePrefix('/chatgpt hello')).toBe(false)
      })

      it('rejects hash without number', () => {
        expect(hasSequencePrefix('#hashtag')).toBe(false)
        expect(hasSequencePrefix('# text')).toBe(false)
      })

      it('rejects empty string', () => {
        expect(hasSequencePrefix('')).toBe(false)
      })

      it('rejects number without hash', () => {
        expect(hasSequencePrefix('1 text')).toBe(false)
      })
    })

    describe('prefix position', () => {
      it('detects prefix anywhere in text', () => {
        expect(hasSequencePrefix('prefix #1 middle')).toBe(true)
        expect(hasSequencePrefix('text #1')).toBe(true)
      })
    })
  })

  describe('extractSequenceNumber', () => {
    describe('successful extraction', () => {
      it('extracts positive numbers', () => {
        expect(extractSequenceNumber('#1 text')).toBe(1)
        expect(extractSequenceNumber('#42 text')).toBe(42)
        expect(extractSequenceNumber('#999 text')).toBe(999)
      })

      it('extracts negative numbers', () => {
        expect(extractSequenceNumber('#-1 text')).toBe(-1)
        expect(extractSequenceNumber('#-42 text')).toBe(-42)
      })

      it('extracts zero', () => {
        expect(extractSequenceNumber('#0 text')).toBe(0)
      })
    })

    describe('failed extraction', () => {
      it('returns null for text without prefix', () => {
        expect(extractSequenceNumber('text')).toBe(null)
        expect(extractSequenceNumber('/chatgpt hello')).toBe(null)
        expect(extractSequenceNumber('')).toBe(null)
      })

      it('returns null for hash without number', () => {
        expect(extractSequenceNumber('#hashtag')).toBe(null)
        expect(extractSequenceNumber('# text')).toBe(null)
      })
    })

    describe('whitespace handling', () => {
      it('handles leading whitespace', () => {
        expect(extractSequenceNumber('  #5 text')).toBe(5)
        expect(extractSequenceNumber('\t#5 text')).toBe(5)
      })
    })

    describe('multiple prefixes', () => {
      it('extracts first number when multiple prefixes present', () => {
        expect(extractSequenceNumber('#1 text #2 more')).toBe(1)
        expect(extractSequenceNumber('#5 #10 #15')).toBe(5)
      })
    })

    describe('number boundaries', () => {
      it('handles very large numbers', () => {
        expect(extractSequenceNumber('#99999999 text')).toBe(99999999)
      })

      it('handles very small numbers', () => {
        expect(extractSequenceNumber('#-99999999 text')).toBe(-99999999)
      })
    })
  })
})
