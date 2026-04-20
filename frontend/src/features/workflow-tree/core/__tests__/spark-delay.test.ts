import { describe, it, expect } from 'vitest'
import { easeOutProgress, invertEaseOut, computeCornerArrivalMs } from '../spark-delay'

/* ──────────────────────────────────────────────────────────
 * easeOutProgress — evaluate CSS ease-out cubic-bezier(0,0,0.58,1)
 * ──────────────────────────────────────────────────────────*/

describe('easeOutProgress', () => {
  describe('boundary values', () => {
    it('returns 0 for t = 0', () => {
      expect(easeOutProgress(0)).toBe(0)
    })

    it('returns 1 for t = 1', () => {
      expect(easeOutProgress(1)).toBe(1)
    })

    it('clamps to 0 for negative t', () => {
      expect(easeOutProgress(-0.5)).toBe(0)
      expect(easeOutProgress(-100)).toBe(0)
    })

    it('clamps to 1 for t > 1', () => {
      expect(easeOutProgress(1.5)).toBe(1)
      expect(easeOutProgress(100)).toBe(1)
    })
  })

  describe('monotonicity', () => {
    it('is strictly increasing over (0, 1)', () => {
      const steps = 50
      let prev = easeOutProgress(0)
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const curr = easeOutProgress(t)
        expect(curr).toBeGreaterThan(prev)
        prev = curr
      }
    })
  })

  describe('ease-out shape', () => {
    it('starts fast — progress at t=0.25 exceeds linear 0.25', () => {
      expect(easeOutProgress(0.25)).toBeGreaterThan(0.25)
    })

    it('decelerates — progress at t=0.75 is less than proportionally ahead', () => {
      const p50 = easeOutProgress(0.5)
      const p75 = easeOutProgress(0.75)
      /* Second half of time produces less progress than first half */
      const firstHalfDelta = p50 - 0
      const secondQuarterDelta = p75 - p50
      expect(secondQuarterDelta).toBeLessThan(firstHalfDelta)
    })

    it('progress at midpoint t=0.5 exceeds 0.5 (ease-out bias)', () => {
      expect(easeOutProgress(0.5)).toBeGreaterThan(0.5)
    })
  })

  describe('range', () => {
    it('always returns values within [0, 1]', () => {
      for (let i = 0; i <= 100; i++) {
        const t = i / 100
        const p = easeOutProgress(t)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(1)
      }
    })
  })
})

/* ──────────────────────────────────────────────────────────
 * invertEaseOut — given progress, return time fraction
 * ──────────────────────────────────────────────────────────*/

describe('invertEaseOut', () => {
  describe('boundary values', () => {
    it('returns 0 for progress = 0', () => {
      expect(invertEaseOut(0)).toBe(0)
    })

    it('returns 1 for progress = 1', () => {
      expect(invertEaseOut(1)).toBe(1)
    })

    it('clamps to 0 for negative progress', () => {
      expect(invertEaseOut(-0.5)).toBe(0)
    })

    it('clamps to 1 for progress > 1', () => {
      expect(invertEaseOut(1.5)).toBe(1)
    })
  })

  describe('monotonicity', () => {
    it('is strictly increasing over (0, 1)', () => {
      const steps = 50
      let prev = invertEaseOut(0)
      for (let i = 1; i <= steps; i++) {
        const p = i / steps
        const curr = invertEaseOut(p)
        expect(curr).toBeGreaterThan(prev)
        prev = curr
      }
    })
  })

  describe('round-trip consistency with easeOutProgress', () => {
    it('invertEaseOut(easeOutProgress(t)) ≈ t for sampled values', () => {
      const samples = [0.1, 0.25, 0.5, 0.75, 0.9]
      for (const t of samples) {
        const roundTrip = invertEaseOut(easeOutProgress(t))
        expect(roundTrip).toBeCloseTo(t, 3)
      }
    })

    it('easeOutProgress(invertEaseOut(p)) ≈ p for sampled values', () => {
      const samples = [0.1, 0.25, 0.5, 0.75, 0.9]
      for (const p of samples) {
        const roundTrip = easeOutProgress(invertEaseOut(p))
        expect(roundTrip).toBeCloseTo(p, 3)
      }
    })
  })

  describe('inverse shape', () => {
    it('time at progress=0.5 is less than 0.5 (ease-out reaches 50% early)', () => {
      expect(invertEaseOut(0.5)).toBeLessThan(0.5)
    })
  })
})

/* ──────────────────────────────────────────────────────────
 * computeCornerArrivalMs — time for spark to reach the wire corner
 * ──────────────────────────────────────────────────────────*/

describe('computeCornerArrivalMs', () => {
  /* Realistic defaults from the codebase */
  const ROW_HEIGHT = 48
  const INDENT = 32
  const PAD = 2
  const DURATION = 750

  describe('degenerate inputs', () => {
    it('returns 0 for rowsFromParent = 0', () => {
      expect(computeCornerArrivalMs(0, ROW_HEIGHT, INDENT, PAD, DURATION)).toBe(0)
    })

    it('returns 0 for negative rowsFromParent', () => {
      expect(computeCornerArrivalMs(-1, ROW_HEIGHT, INDENT, PAD, DURATION)).toBe(0)
    })

    it('returns 0 when horizontal length is zero (indent = 2 * padding)', () => {
      expect(computeCornerArrivalMs(1, ROW_HEIGHT, 4, 2, DURATION)).toBe(0)
    })

    it('returns 0 when horizontal length is negative (indent < 2 * padding)', () => {
      expect(computeCornerArrivalMs(1, ROW_HEIGHT, 2, 2, DURATION)).toBe(0)
    })
  })

  describe('basic properties', () => {
    it('returns a positive value for valid inputs', () => {
      const result = computeCornerArrivalMs(1, ROW_HEIGHT, INDENT, PAD, DURATION)
      expect(result).toBeGreaterThan(0)
    })

    it('returns an integer (result is Math.round)', () => {
      const result = computeCornerArrivalMs(1, ROW_HEIGHT, INDENT, PAD, DURATION)
      expect(result).toBe(Math.round(result))
    })

    it('never exceeds the total spark duration', () => {
      for (let rows = 1; rows <= 20; rows++) {
        const result = computeCornerArrivalMs(rows, ROW_HEIGHT, INDENT, PAD, DURATION)
        expect(result).toBeLessThanOrEqual(DURATION)
      }
    })

    it('always less than duration (corner is never 100% of path)', () => {
      /* Even with very many rows, horizontal segment exists so corner < total */
      const result = computeCornerArrivalMs(100, ROW_HEIGHT, INDENT, PAD, DURATION)
      expect(result).toBeLessThan(DURATION)
    })
  })

  describe('monotonicity with rows', () => {
    it('increases (or stays equal) as rowsFromParent grows', () => {
      let prev = computeCornerArrivalMs(1, ROW_HEIGHT, INDENT, PAD, DURATION)
      for (let rows = 2; rows <= 15; rows++) {
        const curr = computeCornerArrivalMs(rows, ROW_HEIGHT, INDENT, PAD, DURATION)
        expect(curr).toBeGreaterThanOrEqual(prev)
        prev = curr
      }
    })
  })

  describe('proportionality', () => {
    it('scales with spark duration', () => {
      const halfDuration = computeCornerArrivalMs(3, ROW_HEIGHT, INDENT, PAD, DURATION / 2)
      const fullDuration = computeCornerArrivalMs(3, ROW_HEIGHT, INDENT, PAD, DURATION)
      /* half-duration result should be roughly half (rounding ± 1ms) */
      expect(halfDuration).toBeCloseTo(fullDuration / 2, 0)
    })
  })

  describe('geometry: vertical-heavy vs horizontal-heavy paths', () => {
    it('large rows → corner fraction near 1 → arrival close to duration', () => {
      /* 50 rows of 48px = 2400px vertical vs 28px horizontal */
      const result = computeCornerArrivalMs(50, ROW_HEIGHT, INDENT, PAD, DURATION)
      expect(result).toBeGreaterThan(DURATION * 0.8)
    })

    it('single row → corner fraction small → arrival well below duration', () => {
      const result = computeCornerArrivalMs(1, ROW_HEIGHT, INDENT, PAD, DURATION)
      expect(result).toBeLessThan(DURATION * 0.8)
    })
  })

  describe('rowHeight influence', () => {
    it('doubling rowHeight increases arrival time (more vertical travel)', () => {
      const base = computeCornerArrivalMs(2, 32, INDENT, PAD, DURATION)
      const doubled = computeCornerArrivalMs(2, 64, INDENT, PAD, DURATION)
      expect(doubled).toBeGreaterThan(base)
    })
  })
})
