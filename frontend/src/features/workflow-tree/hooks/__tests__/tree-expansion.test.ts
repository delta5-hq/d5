import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import { expansionReducer, deriveExpandedIdsFromNodes, type TreeExpansionState } from '../../hooks/use-tree-expansion'

const state = (ids: string[]): TreeExpansionState => ({
  expandedIds: new Set(ids),
})

const ids = (s: TreeExpansionState): string[] => [...s.expandedIds].sort()

describe('expansionReducer', () => {
  describe('TOGGLE', () => {
    it('adds id when absent', () => {
      const result = expansionReducer(state([]), { type: 'TOGGLE', id: 'a' })
      expect(ids(result)).toEqual(['a'])
    })

    it('removes id when present', () => {
      const result = expansionReducer(state(['a', 'b']), { type: 'TOGGLE', id: 'a' })
      expect(ids(result)).toEqual(['b'])
    })

    it('toggling twice restores original state', () => {
      const initial = state(['a'])
      const toggled = expansionReducer(initial, { type: 'TOGGLE', id: 'a' })
      const restored = expansionReducer(toggled, { type: 'TOGGLE', id: 'a' })
      expect(ids(restored)).toEqual(['a'])
    })

    it('toggling empty string id', () => {
      const result = expansionReducer(state([]), { type: 'TOGGLE', id: '' })
      expect(result.expandedIds.has('')).toBe(true)
    })
  })

  describe('EXPAND', () => {
    it('adds id', () => {
      const result = expansionReducer(state([]), { type: 'EXPAND', id: 'a' })
      expect(ids(result)).toEqual(['a'])
    })

    it('idempotent when id already present', () => {
      const result = expansionReducer(state(['a']), { type: 'EXPAND', id: 'a' })
      expect(ids(result)).toEqual(['a'])
    })

    it('preserves existing ids', () => {
      const result = expansionReducer(state(['a']), { type: 'EXPAND', id: 'b' })
      expect(ids(result)).toEqual(['a', 'b'])
    })
  })

  describe('COLLAPSE', () => {
    it('removes id', () => {
      const result = expansionReducer(state(['a', 'b']), { type: 'COLLAPSE', id: 'a' })
      expect(ids(result)).toEqual(['b'])
    })

    it('idempotent when id absent', () => {
      const result = expansionReducer(state(['a']), { type: 'COLLAPSE', id: 'z' })
      expect(ids(result)).toEqual(['a'])
    })

    it('collapsing last id yields empty set', () => {
      const result = expansionReducer(state(['a']), { type: 'COLLAPSE', id: 'a' })
      expect(result.expandedIds.size).toBe(0)
    })
  })

  describe('EXPAND_ALL', () => {
    it('adds all provided ids', () => {
      const result = expansionReducer(state([]), { type: 'EXPAND_ALL', ids: ['a', 'b', 'c'] })
      expect(ids(result)).toEqual(['a', 'b', 'c'])
    })

    it('merges with existing ids', () => {
      const result = expansionReducer(state(['a']), { type: 'EXPAND_ALL', ids: ['b', 'c'] })
      expect(ids(result)).toEqual(['a', 'b', 'c'])
    })

    it('handles empty array', () => {
      const result = expansionReducer(state(['a']), { type: 'EXPAND_ALL', ids: [] })
      expect(ids(result)).toEqual(['a'])
    })

    it('deduplicates with existing ids', () => {
      const result = expansionReducer(state(['a', 'b']), { type: 'EXPAND_ALL', ids: ['b', 'c'] })
      expect(ids(result)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('COLLAPSE_ALL', () => {
    it('clears all ids', () => {
      const result = expansionReducer(state(['a', 'b', 'c']), { type: 'COLLAPSE_ALL' })
      expect(result.expandedIds.size).toBe(0)
    })

    it('handles already empty set', () => {
      const result = expansionReducer(state([]), { type: 'COLLAPSE_ALL' })
      expect(result.expandedIds.size).toBe(0)
    })
  })

  describe('SET', () => {
    it('replaces entire set', () => {
      const result = expansionReducer(state(['a', 'b']), { type: 'SET', ids: new Set(['x', 'y']) })
      expect(ids(result)).toEqual(['x', 'y'])
    })

    it('replaces with empty set', () => {
      const result = expansionReducer(state(['a']), { type: 'SET', ids: new Set() })
      expect(result.expandedIds.size).toBe(0)
    })
  })

  describe('immutability', () => {
    it.each([
      { action: { type: 'TOGGLE' as const, id: 'a' } },
      { action: { type: 'EXPAND' as const, id: 'b' } },
      { action: { type: 'COLLAPSE' as const, id: 'a' } },
      { action: { type: 'EXPAND_ALL' as const, ids: ['b'] } },
      { action: { type: 'COLLAPSE_ALL' as const } },
      { action: { type: 'SET' as const, ids: new Set(['x']) } },
    ])('$action.type returns new state and new Set reference', ({ action }) => {
      const initial = state(['a'])
      const result = expansionReducer(initial, action)
      expect(result).not.toBe(initial)
      expect(result.expandedIds).not.toBe(initial.expandedIds)
    })

    it('SET creates defensive copy — caller mutation does not affect state', () => {
      const callerSet = new Set(['a', 'b'])
      const result = expansionReducer(state([]), { type: 'SET', ids: callerSet })
      callerSet.add('z')
      expect(result.expandedIds.has('z')).toBe(false)
      expect(result.expandedIds.size).toBe(2)
    })
  })
})

describe('deriveExpandedIdsFromNodes', () => {
  const node = (overrides: Partial<NodeData> & { id: string }): NodeData =>
    ({
      title: overrides.id,
      ...overrides,
    }) as NodeData

  it('always includes rootId', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('root')).toBe(true)
  })

  it('includes rootId even if root has no children', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root' }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('root')).toBe(true)
  })

  it('includes non-collapsed nodes with children', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['a'] }),
      a: node({ id: 'a', parent: 'root', children: ['b'] }),
      b: node({ id: 'b', parent: 'a', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('root')).toBe(true)
    expect(result.has('a')).toBe(true)
    expect(result.has('b')).toBe(false)
  })

  it('excludes nodes with collapsed=true', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['a'] }),
      a: node({ id: 'a', parent: 'root', children: ['b'], collapsed: true }),
      b: node({ id: 'b', parent: 'a', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('a')).toBe(false)
  })

  it('includes nodes with collapsed=false', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['a'] }),
      a: node({ id: 'a', parent: 'root', children: ['b'], collapsed: false }),
      b: node({ id: 'b', parent: 'a', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('a')).toBe(true)
  })

  it('includes nodes with collapsed=undefined', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['a'] }),
      a: node({ id: 'a', parent: 'root', children: ['b'], collapsed: undefined }),
      b: node({ id: 'b', parent: 'a', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('a')).toBe(true)
  })

  it('excludes leaf nodes (no children)', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['leaf'] }),
      leaf: node({ id: 'leaf', parent: 'root', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('leaf')).toBe(false)
  })

  it('excludes nodes with empty children array', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['a'] }),
      a: node({ id: 'a', parent: 'root', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('a')).toBe(false)
  })

  it('excludes nodes without children property', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['a'] }),
      a: node({ id: 'a', parent: 'root' }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('a')).toBe(false)
  })

  it('handles empty tree (only rootId)', () => {
    const result = deriveExpandedIdsFromNodes({}, 'root')
    expect(result.has('root')).toBe(true)
    expect(result.size).toBe(1)
  })

  it('handles deep tree', () => {
    const nodes: Record<string, NodeData> = {}
    for (let i = 0; i < 10; i++) {
      const id = `n${i}`
      const parentId = i === 0 ? undefined : `n${i - 1}`
      const childId = i < 9 ? [`n${i + 1}`] : []
      nodes[id] = node({ id, parent: parentId, children: childId })
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'n0')
    /* All non-leaf nodes should be expanded */
    for (let i = 0; i < 9; i++) {
      expect(result.has(`n${i}`)).toBe(true)
    }
    expect(result.has('n9')).toBe(false)
  })

  it('mixed collapsed states', () => {
    const nodes: Record<string, NodeData> = {
      root: node({ id: 'root', children: ['a', 'b', 'c'] }),
      a: node({ id: 'a', parent: 'root', children: ['a1'], collapsed: false }),
      b: node({ id: 'b', parent: 'root', children: ['b1'], collapsed: true }),
      c: node({ id: 'c', parent: 'root', children: ['c1'] }),
      a1: node({ id: 'a1', parent: 'a', children: [] }),
      b1: node({ id: 'b1', parent: 'b', children: [] }),
      c1: node({ id: 'c1', parent: 'c', children: [] }),
    }
    const result = deriveExpandedIdsFromNodes(nodes, 'root')
    expect(result.has('root')).toBe(true)
    expect(result.has('a')).toBe(true)
    expect(result.has('b')).toBe(false)
    expect(result.has('c')).toBe(true)
  })
})
