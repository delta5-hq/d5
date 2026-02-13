import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import { resolveSelectionAfterDelete } from './node-navigation'

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
