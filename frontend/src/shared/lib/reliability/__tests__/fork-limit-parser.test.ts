import { describe, it, expect } from 'vitest'
import { FORK_LIMIT_SIZES, DEFAULT_FORK_LIMIT, readForkLimit, exceedsForkLimit } from '../fork-limit-parser'

/*
 * Composition invariant:
 *   readForkLimit(cmd) === null  ↔  exceedsForkLimit(anyCost, null)  === false
 *   readForkLimit(cmd) === L     ↔  exceedsForkLimit(cost, L) mirrors cost > L
 *
 * The two functions form a pipeline; testing their composition is the primary
 * safety property — a command with no :limit= must never block execution.
 */

describe('FORK_LIMIT_SIZES', () => {
  it('exports exactly the six canonical T-shirt keys', () => {
    expect(Object.keys(FORK_LIMIT_SIZES).sort()).toEqual(['l', 's', 'xl', 'xxl', 'xxs', 'xs'].sort())
  })

  it('all budgets are positive integers', () => {
    for (const value of Object.values(FORK_LIMIT_SIZES)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })

  it('budgets are strictly ordered xxs < xs < s < l < xl < xxl', () => {
    expect(FORK_LIMIT_SIZES.xxs).toBeLessThan(FORK_LIMIT_SIZES.xs)
    expect(FORK_LIMIT_SIZES.xs).toBeLessThan(FORK_LIMIT_SIZES.s)
    expect(FORK_LIMIT_SIZES.s).toBeLessThan(FORK_LIMIT_SIZES.l)
    expect(FORK_LIMIT_SIZES.l).toBeLessThan(FORK_LIMIT_SIZES.xl)
    expect(FORK_LIMIT_SIZES.xl).toBeLessThan(FORK_LIMIT_SIZES.xxl)
  })

  it('xs budget is 20', () => {
    expect(FORK_LIMIT_SIZES.xs).toBe(20)
  })

  it('s budget is 50', () => {
    expect(FORK_LIMIT_SIZES.s).toBe(50)
  })

  it('every T-shirt key is parseable by readForkLimit and resolves to its budget', () => {
    for (const [key, budget] of Object.entries(FORK_LIMIT_SIZES)) {
      expect(readForkLimit(`/elect :n=3 :limit=${key}`)).toBe(budget)
    }
  })
})

describe('DEFAULT_FORK_LIMIT', () => {
  it('equals the s (small) budget — no hardcoded value', () => {
    expect(DEFAULT_FORK_LIMIT).toBe(FORK_LIMIT_SIZES.s)
  })
})

describe('readForkLimit', () => {
  describe('absent or no-op inputs → null', () => {
    it.each([null, undefined, ''])('returns null for %p', input => {
      expect(readForkLimit(input)).toBeNull()
    })

    it.each(['/elect :n=3', '/elect :n=3 :fallback', '/chat do something', '/validate must include numbers'])(
      'returns null for command without :limit= param: "%s"',
      cmd => {
        expect(readForkLimit(cmd)).toBeNull()
      },
    )
  })

  describe('T-shirt size parsing', () => {
    it.each([
      ['/elect :n=10 :limit=xxs', 10],
      ['/elect :n=10 :limit=xs', 20],
      ['/elect :n=10 :limit=s', 50],
      ['/elect :n=10 :limit=l', 100],
      ['/elect :n=10 :limit=xl', 200],
      ['/elect :n=10 :limit=xxl', 500],
    ])('parses %s → %i', (cmd, expected) => {
      expect(readForkLimit(cmd)).toBe(expected)
    })
  })

  describe('T-shirt prefix disambiguation (longer keys do not bleed into shorter prefixes)', () => {
    it(':limit=xxs is parsed as xxs (10), not xs (20)', () => {
      expect(readForkLimit('/elect :limit=xxs')).toBe(FORK_LIMIT_SIZES.xxs)
    })

    it(':limit=xxl is parsed as xxl (500), not xl (200)', () => {
      expect(readForkLimit('/elect :limit=xxl')).toBe(FORK_LIMIT_SIZES.xxl)
    })

    it(':limit=xl is parsed as xl (200), not l (100)', () => {
      expect(readForkLimit('/elect :limit=xl')).toBe(FORK_LIMIT_SIZES.xl)
    })
  })

  describe('integer passthrough', () => {
    it.each([
      ['/elect :n=3 :limit=1', 1],
      ['/elect :n=3 :limit=30', 30],
      ['/elect :n=3 :limit=999', 999],
    ])('parses %s → %i', (cmd, expected) => {
      expect(readForkLimit(cmd)).toBe(expected)
    })

    it(':limit=0 returns 0 (zero is a valid explicit cap)', () => {
      expect(readForkLimit('/elect :n=3 :limit=0')).toBe(0)
    })

    it('parses when :limit= is the last token with no trailing space', () => {
      expect(readForkLimit('/elect :limit=100')).toBe(100)
    })
  })

  describe('parameter ordering — :limit= is position-independent', () => {
    it.each([
      '/elect :limit=xs :n=10',
      '/elect :n=10 :limit=xs',
      '/elect :limit=xs :n=10 :fallback',
      '/elect :n=10 :fallback :limit=xs',
    ])('extracts xs budget from "%s"', cmd => {
      expect(readForkLimit(cmd)).toBe(FORK_LIMIT_SIZES.xs)
    })
  })

  describe('invalid values → null', () => {
    it('ignores :limit=xs2 (T-shirt token with trailing chars)', () => {
      expect(readForkLimit('/elect :n=3 :limit=xs2')).toBeNull()
    })

    it('ignores :limit=small (unrecognized word)', () => {
      expect(readForkLimit('/elect :n=3 :limit=small')).toBeNull()
    })

    it('ignores :limit=3.5 (decimal — only whole integers are valid)', () => {
      expect(readForkLimit('/elect :n=3 :limit=3.5')).toBeNull()
    })

    it('ignores :limit= with no value (empty after the equals sign)', () => {
      expect(readForkLimit('/elect :n=3 :limit=')).toBeNull()
    })
  })

  describe('multiple :limit= params — first match wins', () => {
    it('returns the first T-shirt limit when two T-shirt params are present', () => {
      expect(readForkLimit('/elect :n=3 :limit=xs :limit=xxl')).toBe(FORK_LIMIT_SIZES.xs)
    })

    it('returns the first integer limit when two integer params are present', () => {
      expect(readForkLimit('/elect :n=3 :limit=10 :limit=99')).toBe(10)
    })
  })
})

describe('exceedsForkLimit', () => {
  describe('absent limit (null / undefined) → never blocked', () => {
    it('returns false when limit is null regardless of cost', () => {
      expect(exceedsForkLimit(0, null)).toBe(false)
      expect(exceedsForkLimit(1000, null)).toBe(false)
    })

    it('returns false when limit is undefined regardless of cost', () => {
      expect(exceedsForkLimit(0, undefined)).toBe(false)
      expect(exceedsForkLimit(1000, undefined)).toBe(false)
    })
  })

  describe('boundary exactness — > not >=', () => {
    it('cost strictly equal to limit is not exceeded', () => {
      expect(exceedsForkLimit(20, 20)).toBe(false)
    })

    it('cost one below limit is not exceeded', () => {
      expect(exceedsForkLimit(19, 20)).toBe(false)
    })

    it('cost one above limit is exceeded', () => {
      expect(exceedsForkLimit(21, 20)).toBe(true)
    })
  })

  describe('zero-limit boundary', () => {
    it('cost of 0 does not exceed a limit of 0', () => {
      expect(exceedsForkLimit(0, 0)).toBe(false)
    })

    it('cost of 1 exceeds a limit of 0', () => {
      expect(exceedsForkLimit(1, 0)).toBe(true)
    })
  })
})

describe('readForkLimit + exceedsForkLimit — pipeline composition', () => {
  it('no :limit= in command → cost is never blocked regardless of value', () => {
    const limit = readForkLimit('/elect :n=3')
    expect(exceedsForkLimit(999, limit)).toBe(false)
  })

  it(':limit=xs command with cost within budget → not blocked', () => {
    const limit = readForkLimit('/elect :n=3 :limit=xs')
    expect(exceedsForkLimit(FORK_LIMIT_SIZES.xs, limit)).toBe(false)
  })

  it(':limit=xs command with cost exceeding budget → blocked', () => {
    const limit = readForkLimit('/elect :n=3 :limit=xs')
    expect(exceedsForkLimit(FORK_LIMIT_SIZES.xs + 1, limit)).toBe(true)
  })

  it('every T-shirt size: cost at exactly the budget is permitted', () => {
    for (const [key, budget] of Object.entries(FORK_LIMIT_SIZES)) {
      const limit = readForkLimit(`/elect :n=2 :limit=${key}`)
      expect(exceedsForkLimit(budget, limit)).toBe(false)
    }
  })

  it('every T-shirt size: cost one above the budget is refused', () => {
    for (const [key, budget] of Object.entries(FORK_LIMIT_SIZES)) {
      const limit = readForkLimit(`/elect :n=2 :limit=${key}`)
      expect(exceedsForkLimit(budget + 1, limit)).toBe(true)
    }
  })
})
