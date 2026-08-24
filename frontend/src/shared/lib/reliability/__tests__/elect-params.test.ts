import { describe, it, expect } from 'vitest'
import { readElectN, readElectTrailingText, isValidElectCell } from '../elect-params'

describe('readElectN', () => {
  describe('absent or malformed :n=', () => {
    it('returns null when :n= is absent', () => expect(readElectN('/elect')).toBeNull())
    it('returns null for undefined input', () => expect(readElectN(undefined)).toBeNull())
    it('returns null for empty string', () => expect(readElectN('')).toBeNull())
    it('returns null when :n= has no digit (trailing equals)', () => expect(readElectN('/elect :n=')).toBeNull())
  })

  describe('below-minimum values', () => {
    it('returns null for :n=0', () => expect(readElectN('/elect :n=0')).toBeNull())
    it('returns null for :n=1', () => expect(readElectN('/elect :n=1')).toBeNull())
  })

  describe('valid values', () => {
    it('returns 2 for the minimum valid :n=2', () => expect(readElectN('/elect :n=2')).toBe(2))
    it('returns 5 for :n=5', () => expect(readElectN('/elect :n=5')).toBe(5))
    it('returns 100 for a large :n=100', () => expect(readElectN('/elect :n=100')).toBe(100))
    it('returns the value when :n= is followed by other params', () =>
      expect(readElectN('/elect :n=2 :fallback')).toBe(2))
    it('does not extract :n= from a different command', () => expect(readElectN('/chat :n=3 query')).toBeNull())
    it('does not extract :n= from an elect lookalike', () => expect(readElectN('/elective :n=3')).toBeNull())
    it('returns the first :n= match when multiple appear', () => expect(readElectN('/elect :n=3 :n=5')).toBe(3))
    it('rejects decimal :n values instead of silently truncating', () => expect(readElectN('/elect :n=3.5')).toBeNull())
  })
})

describe('readElectTrailingText', () => {
  it.each(['/elect :n=3', '/elect :n=3 :fallback', '/elect :limit=s :judge_reasoning :n=3'])(
    'returns empty for parameter-only grammar: %s',
    command => expect(readElectTrailingText(command)).toBe(''),
  )

  it('preserves a criterion that the backend would otherwise ignore', () => {
    expect(readElectTrailingText('/elect :n=3 must cite sources')).toBe('must cite sources')
  })
})

describe('isValidElectCell', () => {
  describe('invalid inputs', () => {
    it('returns false for undefined', () => expect(isValidElectCell(undefined)).toBe(false))
    it('returns false for empty string', () => expect(isValidElectCell('')).toBe(false))
    it('returns false for bare /elect with no :n=', () => expect(isValidElectCell('/elect')).toBe(false))
    it('returns false for /elect :n=1 (below minimum)', () => expect(isValidElectCell('/elect :n=1')).toBe(false))
    it('returns false for a different command even with :n=', () => expect(isValidElectCell('/chat :n=3')).toBe(false))
    it('returns false when /elect has no space separator before params', () =>
      expect(isValidElectCell('/elect:n=2')).toBe(false))
    it('returns false when command shares /elect as a prefix but is a different command', () =>
      expect(isValidElectCell('/electX :n=2')).toBe(false))
  })

  describe('valid cells', () => {
    it('returns true for the minimum valid /elect :n=2', () => expect(isValidElectCell('/elect :n=2')).toBe(true))
    it('returns true with additional params after :n=', () =>
      expect(isValidElectCell('/elect :n=3 :fallback')).toBe(true))
    it('returns true with multiple additional params', () =>
      expect(isValidElectCell('/elect :n=2 :retry=3 :fallback')).toBe(true))
    it('returns true for large :n= values', () => expect(isValidElectCell('/elect :n=100')).toBe(true))
  })
})
