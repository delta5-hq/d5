import { describe, it, expect } from 'vitest'
import { retainExistingIds, excludeIds } from '../workflow-store-set-utils'

describe('retainExistingIds', () => {
  it('returns same reference when all ids exist in nodes', () => {
    const ids = new Set(['a', 'b'])
    const nodes = { a: {}, b: {}, c: {} }
    const result = retainExistingIds(ids, nodes)
    expect(result).toBe(ids)
  })

  it('removes ids not present in nodes', () => {
    const ids = new Set(['a', 'b', 'ghost'])
    const nodes = { a: {}, b: {} }
    const result = retainExistingIds(ids, nodes)
    expect(result).toEqual(new Set(['a', 'b']))
    expect(result).not.toBe(ids)
  })

  it('returns same reference for empty set', () => {
    const ids = new Set<string>()
    const result = retainExistingIds(ids, { a: {} })
    expect(result).toBe(ids)
  })

  it('returns empty set when no ids exist in nodes', () => {
    const ids = new Set(['x', 'y'])
    const result = retainExistingIds(ids, { a: {} })
    expect(result).toEqual(new Set())
  })
})

describe('excludeIds', () => {
  it('returns same reference when no ids overlap', () => {
    const ids = new Set(['a', 'b'])
    const result = excludeIds(ids, new Set(['x', 'y']))
    expect(result).toBe(ids)
  })

  it('removes overlapping ids', () => {
    const ids = new Set(['a', 'b', 'c'])
    const result = excludeIds(ids, new Set(['b', 'c']))
    expect(result).toEqual(new Set(['a']))
    expect(result).not.toBe(ids)
  })

  it('returns same reference for empty source', () => {
    const ids = new Set<string>()
    const result = excludeIds(ids, new Set(['a']))
    expect(result).toBe(ids)
  })

  it('returns empty set when all ids are excluded', () => {
    const ids = new Set(['a', 'b'])
    const result = excludeIds(ids, new Set(['a', 'b', 'c']))
    expect(result).toEqual(new Set())
  })

  it('returns same reference when excluded set is empty', () => {
    const ids = new Set(['a', 'b'])
    const result = excludeIds(ids, new Set())
    expect(result).toBe(ids)
  })
})
