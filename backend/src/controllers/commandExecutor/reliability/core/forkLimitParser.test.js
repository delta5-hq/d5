import {
  FORK_LIMIT_SIZES,
  DEFAULT_FORK_LIMIT,
  readForkLimit,
  exceedsForkLimit,
  forkLimitRefusalMessage,
} from './forkLimitParser'

describe('FORK_LIMIT_SIZES', () => {
  it('defines numeric execution budgets for each T-shirt size', () => {
    expect(typeof FORK_LIMIT_SIZES.xxs).toBe('number')
    expect(typeof FORK_LIMIT_SIZES.xs).toBe('number')
    expect(typeof FORK_LIMIT_SIZES.s).toBe('number')
    expect(typeof FORK_LIMIT_SIZES.l).toBe('number')
    expect(typeof FORK_LIMIT_SIZES.xl).toBe('number')
    expect(typeof FORK_LIMIT_SIZES.xxl).toBe('number')
  })

  it('sizes are ordered smallest to largest', () => {
    expect(FORK_LIMIT_SIZES.xxs).toBeLessThan(FORK_LIMIT_SIZES.xs)
    expect(FORK_LIMIT_SIZES.xs).toBeLessThan(FORK_LIMIT_SIZES.s)
    expect(FORK_LIMIT_SIZES.s).toBeLessThan(FORK_LIMIT_SIZES.l)
    expect(FORK_LIMIT_SIZES.l).toBeLessThan(FORK_LIMIT_SIZES.xl)
    expect(FORK_LIMIT_SIZES.xl).toBeLessThan(FORK_LIMIT_SIZES.xxl)
  })

  it('xs = 20 (matches acceptance-test requirement: :limit=xs → 20)', () => {
    expect(FORK_LIMIT_SIZES.xs).toBe(20)
  })

  it('s = 50 (default per spec)', () => {
    expect(FORK_LIMIT_SIZES.s).toBe(50)
  })
})

describe('DEFAULT_FORK_LIMIT', () => {
  it('equals s (50 executions)', () => {
    expect(DEFAULT_FORK_LIMIT).toBe(FORK_LIMIT_SIZES.s)
  })
})

describe('readForkLimit', () => {
  describe('falsy input → null', () => {
    it.each([null, undefined, ''])('returns null for %p', input => {
      expect(readForkLimit(input)).toBeNull()
    })
  })

  describe(':limit absent → null', () => {
    it.each(['/elect :n=3', '/elect :n=3 :fallback', '/chat do something', '/validate must include numbers'])(
      'returns null for "%s"',
      cmd => {
        expect(readForkLimit(cmd)).toBeNull()
      },
    )
  })

  describe('T-shirt sizes → correct execution budgets', () => {
    it.each([
      ['/elect :n=10 :limit=xxs', 10],
      ['/elect :n=10 :limit=xs', 20],
      ['/elect :n=10 :limit=s', 50],
      ['/elect :n=10 :limit=l', 100],
      ['/elect :n=10 :limit=xl', 200],
      ['/elect :n=10 :limit=xxl', 500],
    ])('parses "%s" → %i', (cmd, expected) => {
      expect(readForkLimit(cmd)).toBe(expected)
    })
  })

  describe('raw integer passthrough', () => {
    it.each([
      ['/elect :n=3 :limit=30', 30],
      ['/elect :n=3 :limit=0', 0],
      ['/elect :n=3 :limit=1', 1],
      ['/elect :n=3 :limit=999', 999],
    ])('parses "%s" → %i', (cmd, expected) => {
      expect(readForkLimit(cmd)).toBe(expected)
    })
  })

  describe('param ordering: :limit can appear anywhere in the command', () => {
    it.each([
      '/elect :limit=xs :n=10',
      '/elect :n=10 :limit=xs',
      '/elect :limit=xs :n=10 :fallback',
      '/elect :n=10 :fallback :limit=xs',
    ])('extracts limit from "%s"', cmd => {
      expect(readForkLimit(cmd)).toBe(20)
    })
  })

  describe('T-shirt tokens with adjacent non-space characters are not matched', () => {
    it('ignores :limit=xs2 (not a valid T-shirt or integer)', () => {
      expect(readForkLimit('/elect :n=3 :limit=xs2')).toBeNull()
    })

    it('ignores :limit=small (unknown size word)', () => {
      expect(readForkLimit('/elect :n=3 :limit=small')).toBeNull()
    })
  })

  describe('when multiple :limit params appear, first match wins', () => {
    it('returns the first :limit value found', () => {
      expect(readForkLimit('/elect :n=3 :limit=xs :limit=xxl')).toBe(20)
    })
  })

  describe('T-shirt prefixes do not bleed into each other', () => {
    it(':limit=xxs parses as xxs (10), not xs (20)', () => {
      expect(readForkLimit('/elect :limit=xxs')).toBe(10)
    })

    it(':limit=xxl parses as xxl (500), not xl (200)', () => {
      expect(readForkLimit('/elect :limit=xxl')).toBe(500)
    })

    it(':limit=xl parses as xl (200), not l (100)', () => {
      expect(readForkLimit('/elect :limit=xl')).toBe(200)
    })
  })
})

describe('exceedsForkLimit', () => {
  it('returns false when limit is null', () => {
    expect(exceedsForkLimit(1000, null)).toBe(false)
  })

  it('returns false when limit is undefined', () => {
    expect(exceedsForkLimit(1000, undefined)).toBe(false)
  })

  it('returns false when projected cost equals the limit', () => {
    expect(exceedsForkLimit(20, 20)).toBe(false)
  })

  it('returns false when projected cost is below the limit', () => {
    expect(exceedsForkLimit(19, 20)).toBe(false)
  })

  it('returns true when projected cost exceeds the limit', () => {
    expect(exceedsForkLimit(21, 20)).toBe(true)
  })

  it('returns true for acceptance-test values: projected=30, limit=20', () => {
    expect(exceedsForkLimit(30, 20)).toBe(true)
  })
})

describe('forkLimitRefusalMessage', () => {
  it('produces the acceptance-test error string', () => {
    expect(forkLimitRefusalMessage(30, 20)).toBe('projected 30 executions exceeds limit 20')
  })

  it('interpolates any numeric values', () => {
    expect(forkLimitRefusalMessage(500, 200)).toBe('projected 500 executions exceeds limit 200')
  })
})

describe('exceedsForkLimit — zero-limit edge cases', () => {
  it('cost of 1 exceeds limit of 0', () => {
    expect(exceedsForkLimit(1, 0)).toBe(true)
  })

  it('cost of 0 does not exceed limit of 0', () => {
    expect(exceedsForkLimit(0, 0)).toBe(false)
  })
})

describe('readForkLimit — integer zero is a valid explicit limit', () => {
  it(':limit=0 returns 0 (not null)', () => {
    expect(readForkLimit('/elect :n=3 :limit=0')).toBe(0)
  })
})

describe('readForkLimit — end-of-string without trailing space', () => {
  it.each([
    ['/elect :limit=xs', 20],
    ['/elect :limit=100', 100],
  ])('"%s" with no trailing space still parses correctly', (cmd, expected) => {
    expect(readForkLimit(cmd)).toBe(expected)
  })
})
