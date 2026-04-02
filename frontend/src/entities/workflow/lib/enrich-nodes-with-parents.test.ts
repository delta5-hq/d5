import { describe, it, expect } from 'vitest'
import { enrichNodesWithParents } from './enrich-nodes-with-parents'
import type { NodeData } from '@shared/base-types'

describe('enrichNodesWithParents', () => {
  describe('parent extraction', () => {
    it('extracts missing parent when child references it', () => {
      const changed = {
        child: { id: 'child', parent: 'parent' } as NodeData,
      }
      const complete = {
        parent: { id: 'parent', prompts: ['child'], children: ['child'] } as NodeData,
        child: { id: 'child', parent: 'parent' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, complete)

      expect(result.parent).toEqual(complete.parent)
      expect(result.child).toEqual(changed.child)
    })

    it('extracts parent once for multiple children sharing parent', () => {
      const changed = {
        c1: { id: 'c1', parent: 'p' } as NodeData,
        c2: { id: 'c2', parent: 'p' } as NodeData,
      }
      const complete = {
        p: { id: 'p', prompts: ['c1', 'c2'], children: ['c1', 'c2'] } as NodeData,
        c1: { id: 'c1', parent: 'p' } as NodeData,
        c2: { id: 'c2', parent: 'p' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, complete)

      expect(result.p).toEqual(complete.p)
      expect(Object.keys(result)).toHaveLength(3)
    })

    it('extracts only immediate parent in nested hierarchy', () => {
      const changed = {
        leaf: { id: 'leaf', parent: 'mid' } as NodeData,
      }
      const complete = {
        root: { id: 'root', children: ['mid'] } as NodeData,
        mid: { id: 'mid', parent: 'root', children: ['leaf'] } as NodeData,
        leaf: { id: 'leaf', parent: 'mid' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, complete)

      expect(result.mid).toEqual(complete.mid)
      expect(result.root).toBeUndefined()
    })

    it('preserves all parent node fields', () => {
      const changed = {
        child: { id: 'child', parent: 'parent' } as NodeData,
      }
      const complete = {
        parent: {
          id: 'parent',
          title: 'Parent Title',
          command: '/instruct test',
          prompts: ['child'],
          children: ['child'],
          color: '#ff0000',
          scale: 1.5,
          tags: ['tag1'],
        } as NodeData,
        child: { id: 'child', parent: 'parent' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, complete)

      expect(result.parent).toEqual(complete.parent)
    })
  })

  describe('deduplication', () => {
    it('prefers changed set version when parent present in both', () => {
      const changed = {
        parent: { id: 'parent', prompts: ['new'], children: ['new'] } as NodeData,
        new: { id: 'new', parent: 'parent' } as NodeData,
      }
      const complete = {
        parent: { id: 'parent', prompts: ['old'], children: ['old'] } as NodeData,
        new: { id: 'new', parent: 'parent' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, complete)

      expect(result.parent).toEqual(changed.parent)
      expect(result.parent.prompts).toEqual(['new'])
    })
  })

  describe('edge cases', () => {
    it('skips extraction when parent missing from complete map', () => {
      const changed = {
        orphan: { id: 'orphan', parent: 'missing' } as NodeData,
      }
      const complete = {
        orphan: { id: 'orphan', parent: 'missing' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, complete)

      expect(result.orphan).toEqual(changed.orphan)
      expect(result.missing).toBeUndefined()
    })

    it('skips nodes without parent field', () => {
      const changed = {
        root: { id: 'root', children: ['c1'] } as NodeData,
      }
      const complete = {
        root: { id: 'root', children: ['c1'] } as NodeData,
        c1: { id: 'c1', parent: 'root' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, complete)

      expect(result.root).toEqual(changed.root)
      expect(result.c1).toBeUndefined()
    })

    it('handles empty changed set', () => {
      const result = enrichNodesWithParents({}, { n1: { id: 'n1' } as NodeData })

      expect(result).toEqual({})
    })

    it('handles empty complete map', () => {
      const changed = {
        child: { id: 'child', parent: 'parent' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, {})

      expect(result).toEqual(changed)
    })

    it('returns same reference when no extraction needed', () => {
      const changed = {
        n1: { id: 'n1', title: 'Updated' } as NodeData,
      }

      const result = enrichNodesWithParents(changed, { n1: { id: 'n1', title: 'Old' } as NodeData })

      expect(result).toBe(changed)
    })
  })

  describe('immutability', () => {
    it('does not mutate changed input', () => {
      const changed = {
        child: { id: 'child', parent: 'parent' } as NodeData,
      }
      const snapshot = JSON.parse(JSON.stringify(changed))

      enrichNodesWithParents(changed, {
        parent: { id: 'parent', prompts: ['child'] } as NodeData,
        child: { id: 'child', parent: 'parent' } as NodeData,
      })

      expect(changed).toEqual(snapshot)
    })

    it('does not mutate complete input', () => {
      const complete = {
        parent: { id: 'parent', prompts: ['child'] } as NodeData,
        child: { id: 'child', parent: 'parent' } as NodeData,
      }
      const snapshot = JSON.parse(JSON.stringify(complete))

      enrichNodesWithParents({ child: { id: 'child', parent: 'parent' } as NodeData }, complete)

      expect(complete).toEqual(snapshot)
    })
  })
})
