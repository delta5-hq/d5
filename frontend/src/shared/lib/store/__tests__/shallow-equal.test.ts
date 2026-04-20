import { describe, it, expect } from 'vitest'
import { shallowEqual } from '../shallow-equal'

describe('shallowEqual', () => {
  it('returns true for identical references', () => {
    const obj = { a: 1 }
    expect(shallowEqual(obj, obj)).toBe(true)
  })

  it('returns true for equal primitives', () => {
    expect(shallowEqual(1, 1)).toBe(true)
    expect(shallowEqual('a', 'a')).toBe(true)
  })

  it('returns false for different primitives', () => {
    expect(shallowEqual(1, 2)).toBe(false)
  })

  it('returns true for shallow-equal objects', () => {
    expect(shallowEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true)
  })

  it('returns false when key count differs', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('returns false for deep inequality', () => {
    const arr1 = [1]
    const arr2 = [1]
    expect(shallowEqual({ a: arr1 }, { a: arr2 })).toBe(false)
  })

  it('handles null values', () => {
    expect(shallowEqual(null, null)).toBe(true)
    expect(shallowEqual(null, { a: 1 })).toBe(false)
    expect(shallowEqual({ a: 1 }, null)).toBe(false)
  })

  it('returns true for empty objects', () => {
    expect(shallowEqual({}, {})).toBe(true)
  })

  it('handles undefined values via Object.is', () => {
    expect(shallowEqual(undefined, undefined)).toBe(true)
    expect(shallowEqual(undefined, null)).toBe(false)
  })

  it('handles NaN via Object.is', () => {
    expect(shallowEqual({ a: NaN }, { a: NaN })).toBe(true)
    expect(shallowEqual(NaN, NaN)).toBe(true)
  })

  it('returns false for different value types', () => {
    expect(shallowEqual(0 as unknown, '' as unknown)).toBe(false)
    expect(shallowEqual(false as unknown, 0 as unknown)).toBe(false)
  })

  it('returns false when key exists in a but not b', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false)
  })
})
