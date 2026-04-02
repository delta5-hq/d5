import { describe, it, expect } from 'vitest'
import { normalizeNodeTitle } from './normalize-title'

describe('normalizeNodeTitle', () => {
  it('returns empty string for undefined', () => {
    expect(normalizeNodeTitle(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(normalizeNodeTitle('')).toBe('')
  })

  it('returns empty string for whitespace-only', () => {
    expect(normalizeNodeTitle('   ')).toBe('')
  })

  it('returns empty string for tab/newline whitespace', () => {
    expect(normalizeNodeTitle('\t\n  ')).toBe('')
  })

  it('preserves normal title', () => {
    expect(normalizeNodeTitle('Hello')).toBe('Hello')
  })

  it('preserves title with leading/trailing spaces', () => {
    expect(normalizeNodeTitle(' Hello ')).toBe(' Hello ')
  })

  it('preserves single character title', () => {
    expect(normalizeNodeTitle('X')).toBe('X')
  })

  it('preserves title with inner whitespace', () => {
    expect(normalizeNodeTitle('Hello World')).toBe('Hello World')
  })

  it('handles null at runtime as empty', () => {
    expect(normalizeNodeTitle(null as unknown as undefined)).toBe('')
  })
})
