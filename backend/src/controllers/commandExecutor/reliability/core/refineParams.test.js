import {readRawRefineN, readRefineN, readFallbackFlag, isValidRefineCell} from './refineParams'

describe('readRawRefineN', () => {
  describe('falsy input → null', () => {
    it.each([null, undefined, ''])('returns null for %p', input => {
      expect(readRawRefineN(input)).toBeNull()
    })
  })

  describe(':n= absent or non-numeric → null', () => {
    it('returns null when :n= is absent', () => {
      expect(readRawRefineN('/refine')).toBeNull()
    })

    it('returns null when :n= has no digit (trailing equals)', () => {
      expect(readRawRefineN('/refine :n=')).toBeNull()
    })

    it('returns null for alphabetic content (:n=abc)', () => {
      expect(readRawRefineN('/refine :n=abc')).toBeNull()
    })
  })

  describe('returns raw integer without range clamping', () => {
    it.each([
      ['/refine :n=0', 0],
      ['/refine :n=1', 1],
      ['/refine :n=2', 2],
      ['/refine :n=5', 5],
      ['/refine :n=100', 100],
    ])('parses "%s" → %i (no clamping applied)', (command, expected) => {
      expect(readRawRefineN(command)).toBe(expected)
    })
  })

  describe('contract: readRawRefineN vs readRefineN differ only below the minimum', () => {
    it('readRefineN returns null for :n=1 while readRawRefineN returns 1', () => {
      expect(readRawRefineN('/refine :n=1')).toBe(1)
      expect(readRefineN('/refine :n=1')).toBeNull()
    })

    it('readRefineN returns null for :n=0 while readRawRefineN returns 0', () => {
      expect(readRawRefineN('/refine :n=0')).toBe(0)
      expect(readRefineN('/refine :n=0')).toBeNull()
    })

    it('both functions return the same value for N >= 2', () => {
      const command = '/refine :n=3'
      expect(readRawRefineN(command)).toBe(readRefineN(command))
    })
  })

  describe(':n= extracted regardless of surrounding parameters', () => {
    it('extracts N when :n= is followed by other params', () => {
      expect(readRawRefineN('/refine :n=3 :fallback')).toBe(3)
    })

    it('returns first :n= match when multiple appear', () => {
      expect(readRawRefineN('/refine :n=2 :n=5')).toBe(2)
    })
  })
})

describe('readRefineN', () => {
  describe('falsy input → null', () => {
    it.each([null, undefined, ''])('returns null for %p', input => {
      expect(readRefineN(input)).toBeNull()
    })
  })

  describe('absent :n= parameter → null', () => {
    it.each(['/refine', '/refine :fallback', '/chat', '/validate criteria'])('returns null for "%s"', command => {
      expect(readRefineN(command)).toBeNull()
    })
  })

  describe('N below the minimum threshold of 2 → null', () => {
    it.each([
      ['/refine :n=0', 0],
      ['/refine :n=1', 1],
    ])('returns null for "%s"', command => {
      expect(readRefineN(command)).toBeNull()
    })
  })

  describe('valid N values (N ≥ 2) → integer', () => {
    it.each([
      ['/refine :n=2', 2],
      ['/refine :n=3', 3],
      ['/refine :n=5', 5],
      ['/refine :n=10', 10],
      ['/refine :n=100', 100],
    ])('parses "%s" → %i', (command, expected) => {
      expect(readRefineN(command)).toBe(expected)
    })
  })

  describe('N is extracted regardless of surrounding parameters', () => {
    it.each([
      ['/refine :n=3 :fallback', 3],
      ['/refine :limit=s :n=5', 5],
      ['/refine :limit=s :n=4 :fallback', 4],
    ])('extracts N from "%s"', (command, expected) => {
      expect(readRefineN(command)).toBe(expected)
    })
  })

  describe('when :n= appears multiple times, first match is used', () => {
    it('returns the first :n= value', () => {
      expect(readRefineN('/refine :n=2 :n=5')).toBe(2)
    })
  })

  describe('non-numeric :n= content', () => {
    it('returns null for alphabetic content (:n=abc)', () => {
      expect(readRefineN('/refine :n=abc')).toBeNull()
    })

    it('truncates decimal at the integer part (:n=3.5 → 3)', () => {
      expect(readRefineN('/refine :n=3.5')).toBe(3)
    })
  })
})

describe('readFallbackFlag', () => {
  describe('falsy input → false', () => {
    it.each([null, undefined, ''])('returns false for %p', input => {
      expect(readFallbackFlag(input)).toBe(false)
    })
  })

  describe(':fallback token absent → false', () => {
    it.each(['/refine :n=3', '/chat', '/validate criteria'])('returns false for "%s"', command => {
      expect(readFallbackFlag(command)).toBe(false)
    })
  })

  describe(':fallback present as a standalone token → true', () => {
    it('detects :fallback at the end of the string', () => {
      expect(readFallbackFlag('/refine :n=3 :fallback')).toBe(true)
    })

    it('detects :fallback when it precedes other parameters', () => {
      expect(readFallbackFlag('/refine :fallback :n=2')).toBe(true)
    })
  })

  describe('word-boundary enforcement: :fallback as a substring is not matched', () => {
    it('returns false when :fallback is a prefix of a longer token (:fallback2)', () => {
      expect(readFallbackFlag('/refine :n=3 :fallback2')).toBe(false)
    })

    it('returns false when :fallback appears embedded in another word', () => {
      expect(readFallbackFlag('/refine :nofallback')).toBe(false)
    })
  })
})

describe('isValidRefineCell', () => {
  describe('falsy input → false', () => {
    it.each([null, undefined, ''])('returns false for %p', input => {
      expect(isValidRefineCell(input)).toBe(false)
    })
  })

  describe('commands other than /refine → false', () => {
    it.each(['/chat :n=3', '/validate :n=3 criteria', '/summarize :n=3', '/outline :n=3', '/claude :n=2'])(
      'returns false for "%s"',
      command => {
        expect(isValidRefineCell(command)).toBe(false)
      },
    )
  })

  describe('word-boundary guard: /refine must not match a longer command name', () => {
    it.each(['/refinement :n=3', '/refinery :n=5', '/refine2 :n=2'])('returns false for "%s"', command => {
      expect(isValidRefineCell(command)).toBe(false)
    })
  })

  describe('/refine command with missing or invalid :n= → false', () => {
    it('returns false for bare /refine', () => {
      expect(isValidRefineCell('/refine')).toBe(false)
    })

    it('returns false for /refine with only :fallback, no :n=', () => {
      expect(isValidRefineCell('/refine :fallback')).toBe(false)
    })

    it.each(['/refine :n=0', '/refine :n=1'])('returns false for "%s" (N below minimum)', command => {
      expect(isValidRefineCell(command)).toBe(false)
    })
  })

  describe('/refine :n=N with N ≥ 2 → true', () => {
    it.each([
      '/refine :n=2',
      '/refine :n=3',
      '/refine :n=5',
      '/refine :n=3 :fallback',
      '/refine :limit=s :n=4',
      '/refine :n=4 :fallback :limit=xs',
    ])('returns true for "%s"', command => {
      expect(isValidRefineCell(command)).toBe(true)
    })
  })
})
