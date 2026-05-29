import { describe, it, expect } from 'vitest'
import { readRefineN, isValidRefineCell } from '../refine-params'

describe('readRefineN', () => {
  describe('absent or malformed :n=', () => {
    it('returns null when :n= is absent', () => expect(readRefineN('/refine')).toBeNull())
    it('returns null for undefined input', () => expect(readRefineN(undefined)).toBeNull())
    it('returns null for empty string', () => expect(readRefineN('')).toBeNull())
    it('returns null when :n= has no digit (trailing equals)', () => expect(readRefineN('/refine :n=')).toBeNull())
  })

  describe('below-minimum values', () => {
    it('returns null for :n=0', () => expect(readRefineN('/refine :n=0')).toBeNull())
    it('returns null for :n=1', () => expect(readRefineN('/refine :n=1')).toBeNull())
  })

  describe('valid values', () => {
    it('returns 2 for the minimum valid :n=2', () => expect(readRefineN('/refine :n=2')).toBe(2))
    it('returns 5 for :n=5', () => expect(readRefineN('/refine :n=5')).toBe(5))
    it('returns 100 for a large :n=100', () => expect(readRefineN('/refine :n=100')).toBe(100))
    it('returns the value when :n= is followed by other params', () =>
      expect(readRefineN('/refine :n=2 :fallback')).toBe(2))
    it('extracts :n= from any command string regardless of command prefix', () =>
      expect(readRefineN('/chat :n=3 query')).toBe(3))
    it('returns the first :n= match when multiple appear', () => expect(readRefineN('/refine :n=3 :n=5')).toBe(3))
  })
})

describe('isValidRefineCell', () => {
  describe('invalid inputs', () => {
    it('returns false for undefined', () => expect(isValidRefineCell(undefined)).toBe(false))
    it('returns false for empty string', () => expect(isValidRefineCell('')).toBe(false))
    it('returns false for bare /refine with no :n=', () => expect(isValidRefineCell('/refine')).toBe(false))
    it('returns false for /refine :n=1 (below minimum)', () => expect(isValidRefineCell('/refine :n=1')).toBe(false))
    it('returns false for a different command even with :n=', () => expect(isValidRefineCell('/chat :n=3')).toBe(false))
    it('returns false when /refine has no space separator before params', () =>
      expect(isValidRefineCell('/refine:n=2')).toBe(false))
    it('returns false when command shares /refine as a prefix but is a different command', () =>
      expect(isValidRefineCell('/refineX :n=2')).toBe(false))
  })

  describe('valid cells', () => {
    it('returns true for the minimum valid /refine :n=2', () => expect(isValidRefineCell('/refine :n=2')).toBe(true))
    it('returns true with additional params after :n=', () =>
      expect(isValidRefineCell('/refine :n=3 :fallback')).toBe(true))
    it('returns true with multiple additional params', () =>
      expect(isValidRefineCell('/refine :n=2 :retry=3 :fallback')).toBe(true))
    it('returns true for large :n= values', () => expect(isValidRefineCell('/refine :n=100')).toBe(true))
  })
})
