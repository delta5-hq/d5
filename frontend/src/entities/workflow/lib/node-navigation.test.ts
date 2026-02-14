import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import { getTopLevelIds, resolveSelectionAfterDelete } from './node-navigation'

const createTree = (): Record<string, NodeData> => ({
  root: { id: 'root', title: 'Root', children: ['a', 'b', 'c'] },
  a: { id: 'a', title: 'A', parent: 'root', children: ['a1'] },
  b: { id: 'b', title: 'B', parent: 'root', children: [] },
  c: { id: 'c', title: 'C', parent: 'root', children: [] },
  a1: { id: 'a1', title: 'A1', parent: 'a', children: [] },
})

describe('resolveSelectionAfterDelete', () => {
  describe('sibling selection', () => {
    it('selects next sibling for first child', () => {
      expect(resolveSelectionAfterDelete(createTree(), 'a')).toBe('b')
    })

    it('prefers next sibling over previous for middle child', () => {
      expect(resolveSelectionAfterDelete(createTree(), 'b')).toBe('c')
    })

    it('selects previous sibling when last child', () => {
      expect(resolveSelectionAfterDelete(createTree(), 'c')).toBe('b')
    })
  })

  describe('parent fallback', () => {
    it('selects parent when only child', () => {
      expect(resolveSelectionAfterDelete(createTree(), 'a1')).toBe('a')
    })

    it('selects parent when all siblings are removed from map', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: ['x', 'y'] },
        x: { id: 'x', title: 'X', parent: 'root', children: [] },
      }
      expect(resolveSelectionAfterDelete(nodes, 'x')).toBe('root')
    })
  })

  describe('unresolvable cases', () => {
    it('returns undefined for root node', () => {
      expect(resolveSelectionAfterDelete(createTree(), 'root')).toBeUndefined()
    })

    it('returns undefined for nonexistent node', () => {
      expect(resolveSelectionAfterDelete(createTree(), 'missing')).toBeUndefined()
    })

    it('returns undefined for empty nodes record', () => {
      expect(resolveSelectionAfterDelete({}, 'any')).toBeUndefined()
    })
  })

  describe('inconsistent data', () => {
    it('returns parent id when parent node missing from map', () => {
      const nodes: Record<string, NodeData> = {
        orphan: { id: 'orphan', title: 'Orphan', parent: 'gone', children: [] },
      }
      expect(resolveSelectionAfterDelete(nodes, 'orphan')).toBe('gone')
    })

    it('returns parent when node not listed in parent children', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: ['other'] },
        other: { id: 'other', title: 'Other', parent: 'root', children: [] },
        stale: { id: 'stale', title: 'Stale', parent: 'root', children: [] },
      }
      expect(resolveSelectionAfterDelete(nodes, 'stale')).toBe('root')
    })

    it('returns parent when parent has no children property', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root' },
        child: { id: 'child', title: 'Child', parent: 'root' },
      }
      expect(resolveSelectionAfterDelete(nodes, 'child')).toBe('root')
    })

    it('returns parent when parent has empty children array', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: [] },
        child: { id: 'child', title: 'Child', parent: 'root' },
      }
      expect(resolveSelectionAfterDelete(nodes, 'child')).toBe('root')
    })

    it('skips ghost next sibling and selects previous', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: ['a', 'b', 'ghost'] },
        a: { id: 'a', title: 'A', parent: 'root', children: [] },
        b: { id: 'b', title: 'B', parent: 'root', children: [] },
      }
      expect(resolveSelectionAfterDelete(nodes, 'b')).toBe('a')
    })

    it('falls back to parent when all siblings are ghost nodes', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: ['ghost1', 'real', 'ghost2'] },
        real: { id: 'real', title: 'Real', parent: 'root', children: [] },
      }
      expect(resolveSelectionAfterDelete(nodes, 'real')).toBe('root')
    })
  })
})

describe('getTopLevelIds', () => {
  const tree: Record<string, NodeData> = {
    root: { id: 'root', title: 'Root', children: ['a', 'b'] },
    a: { id: 'a', title: 'A', parent: 'root', children: ['a1', 'a2'] },
    b: { id: 'b', title: 'B', parent: 'root', children: [] },
    a1: { id: 'a1', title: 'A1', parent: 'a', children: [] },
    a2: { id: 'a2', title: 'A2', parent: 'a', children: [] },
  }

  it('returns single node unchanged', () => {
    expect(getTopLevelIds(tree, new Set(['a']))).toEqual(['a'])
  })

  it('returns all when no ancestor relationship exists', () => {
    expect(getTopLevelIds(tree, new Set(['a', 'b']))).toEqual(['a', 'b'])
  })

  it('filters descendants when ancestor is in the set', () => {
    expect(getTopLevelIds(tree, new Set(['a', 'a1', 'a2']))).toEqual(['a'])
  })

  it('keeps nodes from independent branches', () => {
    expect(getTopLevelIds(tree, new Set(['a1', 'b']))).toEqual(['a1', 'b'])
  })

  it('returns empty for empty set', () => {
    expect(getTopLevelIds(tree, new Set())).toEqual([])
  })

  it('excludes nonexistent node ids', () => {
    expect(getTopLevelIds(tree, new Set(['missing', 'a']))).toEqual(['a'])
  })

  it('handles root in selection set — root is valid top-level node', () => {
    expect(getTopLevelIds(tree, new Set(['root', 'a', 'b']))).toEqual(['root'])
  })

  it('handles deeply nested ancestor filtering', () => {
    const deep: Record<string, NodeData> = {
      r: { id: 'r', title: '', children: ['l1'] },
      l1: { id: 'l1', title: '', parent: 'r', children: ['l2'] },
      l2: { id: 'l2', title: '', parent: 'l1', children: ['l3'] },
      l3: { id: 'l3', title: '', parent: 'l2', children: [] },
    }
    expect(getTopLevelIds(deep, new Set(['l1', 'l3']))).toEqual(['l1'])
  })
})
