import {
  readRawElectN,
  readElectN,
  readFallbackFlag,
  readJudgeReasoningFlag,
  readElectTrailingText,
  isValidElectCell,
} from './electParams'

describe('readRawElectN', () => {
  describe('falsy input → null', () => {
    it.each([null, undefined, ''])('returns null for %p', input => {
      expect(readRawElectN(input)).toBeNull()
    })
  })

  describe(':n= absent or non-numeric → null', () => {
    it('returns null when :n= is absent', () => {
      expect(readRawElectN('/elect')).toBeNull()
    })

    it('returns null when :n= has no digit (trailing equals)', () => {
      expect(readRawElectN('/elect :n=')).toBeNull()
    })

    it('returns null for alphabetic content (:n=abc)', () => {
      expect(readRawElectN('/elect :n=abc')).toBeNull()
    })

    it('does not parse an elect lookalike command', () => {
      expect(readRawElectN('/elective :n=3')).toBeNull()
    })
  })

  describe('returns raw integer without range clamping', () => {
    it.each([
      ['/elect :n=0', 0],
      ['/elect :n=1', 1],
      ['/elect :n=2', 2],
      ['/elect :n=5', 5],
      ['/elect :n=100', 100],
    ])('parses "%s" → %i (no clamping applied)', (command, expected) => {
      expect(readRawElectN(command)).toBe(expected)
    })
  })

  describe('contract: readRawElectN vs readElectN differ only below the minimum', () => {
    it('readElectN returns null for :n=1 while readRawElectN returns 1', () => {
      expect(readRawElectN('/elect :n=1')).toBe(1)
      expect(readElectN('/elect :n=1')).toBeNull()
    })

    it('readElectN returns null for :n=0 while readRawElectN returns 0', () => {
      expect(readRawElectN('/elect :n=0')).toBe(0)
      expect(readElectN('/elect :n=0')).toBeNull()
    })

    it('both functions return the same value for N >= 2', () => {
      const command = '/elect :n=3'
      expect(readRawElectN(command)).toBe(readElectN(command))
    })
  })

  describe(':n= extracted regardless of surrounding parameters', () => {
    it('extracts N when :n= is followed by other params', () => {
      expect(readRawElectN('/elect :n=3 :fallback')).toBe(3)
    })

    it('returns first :n= match when multiple appear', () => {
      expect(readRawElectN('/elect :n=2 :n=5')).toBe(2)
    })
  })
})

describe('readElectN', () => {
  describe('falsy input → null', () => {
    it.each([null, undefined, ''])('returns null for %p', input => {
      expect(readElectN(input)).toBeNull()
    })
  })

  describe('absent :n= parameter → null', () => {
    it.each(['/elect', '/elect :fallback', '/elective :n=3', '/chat', '/validate criteria'])(
      'returns null for "%s"',
      command => {
        expect(readElectN(command)).toBeNull()
      },
    )
  })

  describe('N below the minimum threshold of 2 → null', () => {
    it.each([
      ['/elect :n=0', 0],
      ['/elect :n=1', 1],
    ])('returns null for "%s"', command => {
      expect(readElectN(command)).toBeNull()
    })
  })

  describe('valid N values (N ≥ 2) → integer', () => {
    it.each([
      ['/elect :n=2', 2],
      ['/elect :n=3', 3],
      ['/elect :n=5', 5],
      ['/elect :n=10', 10],
      ['/elect :n=100', 100],
    ])('parses "%s" → %i', (command, expected) => {
      expect(readElectN(command)).toBe(expected)
    })
  })

  describe('N is extracted regardless of surrounding parameters', () => {
    it.each([
      ['/elect :n=3 :fallback', 3],
      ['/elect :limit=s :n=5', 5],
      ['/elect :limit=s :n=4 :fallback', 4],
    ])('extracts N from "%s"', (command, expected) => {
      expect(readElectN(command)).toBe(expected)
    })
  })

  describe('when :n= appears multiple times, first match is used', () => {
    it('returns the first :n= value', () => {
      expect(readElectN('/elect :n=2 :n=5')).toBe(2)
    })
  })

  describe('non-numeric :n= content', () => {
    it('returns null for alphabetic content (:n=abc)', () => {
      expect(readElectN('/elect :n=abc')).toBeNull()
    })

    it('rejects decimal content instead of silently truncating it', () => {
      expect(readElectN('/elect :n=3.5')).toBeNull()
    })
  })
})

describe('readElectTrailingText', () => {
  it.each(['/elect :n=3', '/elect :n=3 :fallback', '/elect :limit=s :judge_reasoning :n=4', '/elect :n=3   '])(
    'accepts the parameter-only grammar: %s',
    command => {
      expect(readElectTrailingText(command)).toBe('')
    },
  )

  it.each([
    ['/elect :n=3 must be concise', 'must be concise'],
    ['/elect :n=3 :fallback must cite sources', 'must cite sources'],
    ['/elect :n=3 :unknown', ':unknown'],
  ])('returns inert trailing text from %s', (command, expected) => {
    expect(readElectTrailingText(command)).toBe(expected)
  })
})

describe('readFallbackFlag', () => {
  describe('falsy input → false', () => {
    it.each([null, undefined, ''])('returns false for %p', input => {
      expect(readFallbackFlag(input)).toBe(false)
    })
  })

  describe(':fallback token absent → false', () => {
    it.each(['/elect :n=3', '/chat', '/validate criteria'])('returns false for "%s"', command => {
      expect(readFallbackFlag(command)).toBe(false)
    })
  })

  describe(':fallback present as a standalone token → true', () => {
    it('detects :fallback at the end of the string', () => {
      expect(readFallbackFlag('/elect :n=3 :fallback')).toBe(true)
    })

    it('detects :fallback when it precedes other parameters', () => {
      expect(readFallbackFlag('/elect :fallback :n=2')).toBe(true)
    })
  })

  describe('word-boundary enforcement: :fallback as a substring is not matched', () => {
    it('returns false when :fallback is a prefix of a longer token (:fallback2)', () => {
      expect(readFallbackFlag('/elect :n=3 :fallback2')).toBe(false)
    })

    it('returns false when :fallback appears embedded in another word', () => {
      expect(readFallbackFlag('/elect :nofallback')).toBe(false)
    })
  })
})

describe('isValidElectCell', () => {
  describe('falsy input → false', () => {
    it.each([null, undefined, ''])('returns false for %p', input => {
      expect(isValidElectCell(input)).toBe(false)
    })
  })

  describe('commands other than /elect → false', () => {
    it.each(['/chat :n=3', '/validate :n=3 criteria', '/summarize :n=3', '/outline :n=3', '/claude :n=2'])(
      'returns false for "%s"',
      command => {
        expect(isValidElectCell(command)).toBe(false)
      },
    )
  })

  describe('word-boundary guard: /elect must not match a longer command name', () => {
    it.each(['/refinement :n=3', '/electry :n=5', '/elect2 :n=2'])('returns false for "%s"', command => {
      expect(isValidElectCell(command)).toBe(false)
    })
  })

  describe('/elect command with missing or invalid :n= → false', () => {
    it('returns false for bare /elect', () => {
      expect(isValidElectCell('/elect')).toBe(false)
    })

    it('returns false for /elect with only :fallback, no :n=', () => {
      expect(isValidElectCell('/elect :fallback')).toBe(false)
    })

    it.each(['/elect :n=0', '/elect :n=1'])('returns false for "%s" (N below minimum)', command => {
      expect(isValidElectCell(command)).toBe(false)
    })
  })

  describe('/elect :n=N with N ≥ 2 → true', () => {
    it.each([
      '/elect :n=2',
      '/elect :n=3',
      '/elect :n=5',
      '/elect :n=3 :fallback',
      '/elect :limit=s :n=4',
      '/elect :n=4 :fallback :limit=xs',
    ])('returns true for "%s"', command => {
      expect(isValidElectCell(command)).toBe(true)
    })
  })
})

describe('readJudgeReasoningFlag', () => {
  describe('falsy input → false', () => {
    it.each([null, undefined, ''])('returns false for %p', input => {
      expect(readJudgeReasoningFlag(input)).toBe(false)
    })
  })

  describe(':judge_reasoning token absent → false', () => {
    it.each(['/elect :n=3', '/elect :n=3 :fallback', '/chat', '/validate criteria'])(
      'returns false for "%s"',
      command => {
        expect(readJudgeReasoningFlag(command)).toBe(false)
      },
    )
  })

  describe(':judge_reasoning present as a standalone token → true', () => {
    it('detects :judge_reasoning at the end of the string', () => {
      expect(readJudgeReasoningFlag('/elect :n=3 :judge_reasoning')).toBe(true)
    })

    it('detects :judge_reasoning when it precedes other parameters', () => {
      expect(readJudgeReasoningFlag('/elect :judge_reasoning :n=2')).toBe(true)
    })

    it('detects :judge_reasoning alongside :fallback', () => {
      expect(readJudgeReasoningFlag('/elect :n=3 :fallback :judge_reasoning')).toBe(true)
    })
  })

  describe('word-boundary enforcement: :judge_reasoning as a substring is not matched', () => {
    it('returns false when :judge_reasoning is a prefix of a longer token', () => {
      expect(readJudgeReasoningFlag('/elect :n=3 :judge_reasoning_extra')).toBe(false)
    })

    it('returns false when embedded in another word', () => {
      expect(readJudgeReasoningFlag('/elect :nojudge_reasoning')).toBe(false)
    })
  })
})
