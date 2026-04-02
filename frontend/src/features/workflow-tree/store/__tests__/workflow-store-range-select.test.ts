import { describe, it, expect } from 'vitest'
import { computeRangeSelection } from '../workflow-store-range-select'

describe('computeRangeSelection', () => {
  const order = ['root', 'a', 'b', 'c', 'd', 'e']

  it('returns null when anchorId is undefined', () => {
    expect(computeRangeSelection(undefined, 'c', order)).toBeNull()
  })

  it('returns null when anchorId is not in visible order', () => {
    expect(computeRangeSelection('missing', 'c', order)).toBeNull()
  })

  it('returns null when targetId is not in visible order', () => {
    expect(computeRangeSelection('a', 'missing', order)).toBeNull()
  })

  it('selects forward range (anchor before target)', () => {
    const result = computeRangeSelection('a', 'd', order)!
    expect(result.selectedIds).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(result.selectedId).toBe('d')
  })

  it('selects backward range (anchor after target)', () => {
    const result = computeRangeSelection('d', 'a', order)!
    expect(result.selectedIds).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(result.selectedId).toBe('a')
  })

  it('selects single node when anchor equals target', () => {
    const result = computeRangeSelection('b', 'b', order)!
    expect(result.selectedIds).toEqual(new Set(['b']))
    expect(result.selectedId).toBe('b')
  })

  it('selects full range from first to last', () => {
    const result = computeRangeSelection('root', 'e', order)!
    expect(result.selectedIds).toEqual(new Set(order))
    expect(result.selectedId).toBe('e')
  })

  it('works with single-element visible order', () => {
    const result = computeRangeSelection('x', 'x', ['x'])!
    expect(result.selectedIds).toEqual(new Set(['x']))
    expect(result.selectedId).toBe('x')
  })

  it('returns null for empty visible order', () => {
    expect(computeRangeSelection('a', 'b', [])).toBeNull()
  })
})
