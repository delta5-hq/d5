import {isValidateCell, readValidateN, readValidateRetry, readValidateCriterion} from './validateParams'

describe('isValidateCell', () => {
  describe('falsy input → false', () => {
    it.each([null, undefined, ''])('returns false for %p', input => {
      expect(isValidateCell(input)).toBe(false)
    })
  })

  describe('non-/validate commands → false', () => {
    it.each([
      '/chat must include numbers',
      '/refine :n=3',
      '/summarize',
      '/foreach',
      '/outline',
      'validate without slash',
    ])('returns false for "%s"', cmd => {
      expect(isValidateCell(cmd)).toBe(false)
    })
  })

  describe('whitespace separator — space or tab both qualify after /validate', () => {
    it('returns true for /validate followed by a tab', () => {
      expect(isValidateCell('/validate\tcriteria')).toBe(true)
    })
  })

  describe('word-boundary: /validate must not match longer names', () => {
    it.each(['/validation criteria', '/validator criteria', '/validate2 criteria'])('returns false for "%s"', cmd => {
      expect(isValidateCell(cmd)).toBe(false)
    })
  })

  describe('/validate commands → true', () => {
    it.each([
      '/validate',
      '/validate must include numbers',
      '/validate :n=3 must include numbers',
      '/validate :n=2 :retry=5 must mention competitors',
      '/validate :verifier=claude must cite sources',
    ])('returns true for "%s"', cmd => {
      expect(isValidateCell(cmd)).toBe(true)
    })
  })
})

describe('readValidateN', () => {
  describe('absent or falsy → 1 (single juror default)', () => {
    it.each([null, undefined, ''])('returns 1 for %p', input => {
      expect(readValidateN(input)).toBe(1)
    })

    it('returns 1 when :n= is absent', () => {
      expect(readValidateN('/validate must include numbers')).toBe(1)
    })
  })

  describe('valid :n= values', () => {
    it.each([
      ['/validate :n=1 criteria', 1],
      ['/validate :n=2 criteria', 2],
      ['/validate :n=3 criteria', 3],
      ['/validate :n=5 criteria', 5],
    ])('parses "%s" → %i', (cmd, expected) => {
      expect(readValidateN(cmd)).toBe(expected)
    })
  })

  describe(':n=0 → 1 (clamps below-minimum to 1)', () => {
    it('clamps 0 to 1', () => {
      expect(readValidateN('/validate :n=0 criteria')).toBe(1)
    })
  })

  describe('N can appear before or after criterion text', () => {
    it('extracts :n= from complex command', () => {
      expect(readValidateN('/validate must include :n=3 numbers')).toBe(3)
    })
  })

  describe('multiple :n= params — first match wins', () => {
    it('returns first :n= value when multiple appear', () => {
      expect(readValidateN('/validate :n=3 :n=5 criterion')).toBe(3)
    })
  })
})

describe('readValidateRetry', () => {
  describe('absent or falsy → 3 (spec default)', () => {
    it.each([null, undefined, ''])('returns 3 for %p', input => {
      expect(readValidateRetry(input)).toBe(3)
    })

    it('returns 3 when :retry= is absent', () => {
      expect(readValidateRetry('/validate must include numbers')).toBe(3)
    })
  })

  describe('valid :retry= values', () => {
    it.each([
      ['/validate :retry=0 criteria', 0],
      ['/validate :retry=1 criteria', 1],
      ['/validate :retry=5 criteria', 5],
      ['/validate :retry=10 criteria', 10],
    ])('parses "%s" → %i', (cmd, expected) => {
      expect(readValidateRetry(cmd)).toBe(expected)
    })
  })

  describe(':retry can be combined with other params', () => {
    it('extracts :retry= from command with :n= and criteria', () => {
      expect(readValidateRetry('/validate :n=3 :retry=2 must mention competitors')).toBe(2)
    })
  })

  describe('multiple :retry= params — first match wins', () => {
    it('returns first :retry= value when multiple appear', () => {
      expect(readValidateRetry('/validate :retry=2 :retry=7 criterion')).toBe(2)
    })
  })
})

describe('readValidateCriterion', () => {
  describe('falsy input → empty string', () => {
    it.each([null, undefined, ''])('returns "" for %p', input => {
      expect(readValidateCriterion(input)).toBe('')
    })
  })

  describe('plain criterion (no params)', () => {
    it('returns criterion text verbatim', () => {
      expect(readValidateCriterion('/validate must include at least 3 competitors')).toBe(
        'must include at least 3 competitors',
      )
    })

    it('strips the /validate keyword only', () => {
      expect(readValidateCriterion('/validate text')).toBe('text')
    })

    it('bare /validate with no criterion returns empty string', () => {
      expect(readValidateCriterion('/validate')).toBe('')
    })
  })

  describe('criterion with :n= stripped', () => {
    it('strips :n= and returns remaining text', () => {
      expect(readValidateCriterion('/validate :n=3 must include numbers')).toBe('must include numbers')
    })
  })

  describe('criterion with :retry= stripped', () => {
    it('strips :retry= and returns remaining text', () => {
      expect(readValidateCriterion('/validate :retry=5 must mention revenue')).toBe('must mention revenue')
    })
  })

  describe('criterion with :verifier= stripped', () => {
    it('strips :verifier= and returns remaining text', () => {
      expect(readValidateCriterion('/validate :verifier=claude must cite sources')).toBe('must cite sources')
    })
  })

  describe('criterion with multiple params stripped', () => {
    it('strips all known params and returns only natural-language criterion', () => {
      expect(readValidateCriterion('/validate :n=3 :retry=2 :verifier=claude must include revenue figures')).toBe(
        'must include revenue figures',
      )
    })
  })

  describe('multi-word criterion is preserved intact', () => {
    it('preserves all words after stripping command and params', () => {
      const criterion = 'must contain company names, revenue figures, and market share percentages'
      expect(readValidateCriterion(`/validate ${criterion}`)).toBe(criterion)
    })
  })

  describe('criterion whitespace is trimmed', () => {
    it('leading and trailing whitespace around criterion is removed', () => {
      expect(readValidateCriterion('/validate :n=3   must include numbers  ')).toBe('must include numbers')
    })
  })

  describe('param embedded mid-criterion: surrounding words preserved', () => {
    it('param removed in-place; surrounding words remain (with whitespace gap)', () => {
      // ':n=3' is excised, leaving a double space; .trim() only strips outer whitespace
      expect(readValidateCriterion('/validate must include :n=3 numbers')).toBe('must include  numbers')
    })
  })
})
