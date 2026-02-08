import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import {
  isValidNodeData,
  isDescendantOf,
  getDescendantIds,
  getAncestorIds,
  findRootId,
  hasCircularReference,
} from './node-validation'

const createTestTree = (): Record<string, NodeData> => ({
  root: { id: 'root', title: 'Root', children: ['a', 'b'] },
  a: { id: 'a', title: 'A', parent: 'root', children: ['a1', 'a2'] },
  b: { id: 'b', title: 'B', parent: 'root', children: [] },
  a1: { id: 'a1', title: 'A1', parent: 'a', children: ['a1x'] },
  a2: { id: 'a2', title: 'A2', parent: 'a', children: [] },
  a1x: { id: 'a1x', title: 'A1X', parent: 'a1', children: [] },
})

describe('isValidNodeData', () => {
  it('returns true for valid partial node', () => {
    expect(isValidNodeData({ title: 'Test' })).toBe(true)
    expect(isValidNodeData({ id: 'abc', title: 'Test' })).toBe(true)
    expect(isValidNodeData({})).toBe(true)
  })

  it('returns false for non-objects', () => {
    expect(isValidNodeData(null)).toBe(false)
    expect(isValidNodeData(undefined)).toBe(false)
    expect(isValidNodeData('string')).toBe(false)
    expect(isValidNodeData(123)).toBe(false)
    expect(isValidNodeData(true)).toBe(false)
  })

  it('returns false for invalid field types', () => {
    expect(isValidNodeData({ id: 123 })).toBe(false)
    expect(isValidNodeData({ title: 123 })).toBe(false)
    expect(isValidNodeData({ parent: 123 })).toBe(false)
    expect(isValidNodeData({ children: 'not-array' })).toBe(false)
  })

  it('returns false for arrays with non-string children', () => {
    expect(isValidNodeData({ children: [123, 456] })).toBe(false)
    expect(isValidNodeData({ children: ['valid', 123] })).toBe(false)
    expect(isValidNodeData({ children: [null] })).toBe(false)
  })

  it('returns true for extra unknown properties', () => {
    expect(isValidNodeData({ title: 'Test', customField: 'value' })).toBe(true)
    expect(isValidNodeData({ metadata: { x: 1 } })).toBe(true)
  })

  it('returns true for empty children array', () => {
    expect(isValidNodeData({ children: [] })).toBe(true)
  })
})

describe('isDescendantOf', () => {
  it('returns true when node is descendant', () => {
    const nodes = createTestTree()
    expect(isDescendantOf(nodes, 'a1', 'root')).toBe(true)
    expect(isDescendantOf(nodes, 'a1x', 'root')).toBe(true)
    expect(isDescendantOf(nodes, 'a1x', 'a')).toBe(true)
    expect(isDescendantOf(nodes, 'a1x', 'a1')).toBe(true)
  })

  it('returns false when node is not descendant', () => {
    const nodes = createTestTree()
    expect(isDescendantOf(nodes, 'root', 'a')).toBe(false)
    expect(isDescendantOf(nodes, 'a', 'b')).toBe(false)
    expect(isDescendantOf(nodes, 'a1', 'a2')).toBe(false)
  })

  it('returns false for same node', () => {
    const nodes = createTestTree()
    expect(isDescendantOf(nodes, 'a', 'a')).toBe(false)
  })

  it('handles non-existent nodes', () => {
    const nodes = createTestTree()
    expect(isDescendantOf(nodes, 'nonexistent', 'root')).toBe(false)
  })

  it('returns false for root as descendant of any node', () => {
    const nodes = createTestTree()
    expect(isDescendantOf(nodes, 'root', 'a')).toBe(false)
    expect(isDescendantOf(nodes, 'root', 'a1x')).toBe(false)
  })
})

describe('getDescendantIds', () => {
  it('returns all descendants', () => {
    const nodes = createTestTree()
    const descendants = getDescendantIds(nodes, 'a')
    expect(descendants).toContain('a1')
    expect(descendants).toContain('a2')
    expect(descendants).toContain('a1x')
    expect(descendants).toHaveLength(3)
  })

  it('returns empty array for leaf nodes', () => {
    const nodes = createTestTree()
    expect(getDescendantIds(nodes, 'a1x')).toEqual([])
    expect(getDescendantIds(nodes, 'b')).toEqual([])
  })

  it('handles non-existent nodes', () => {
    const nodes = createTestTree()
    expect(getDescendantIds(nodes, 'nonexistent')).toEqual([])
  })

  it('includes children that reference missing nodes without crashing', () => {
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Root', children: ['a', 'missing'] },
      a: { id: 'a', title: 'A', parent: 'root', children: [] },
    }
    const descendants = getDescendantIds(nodes, 'root')
    expect(descendants).toContain('a')
    expect(descendants).toContain('missing')
  })
})

describe('getAncestorIds', () => {
  it('returns all ancestors in order', () => {
    const nodes = createTestTree()
    expect(getAncestorIds(nodes, 'a1x')).toEqual(['a1', 'a', 'root'])
  })

  it('returns empty array for root', () => {
    const nodes = createTestTree()
    expect(getAncestorIds(nodes, 'root')).toEqual([])
  })

  it('handles non-existent nodes', () => {
    const nodes = createTestTree()
    expect(getAncestorIds(nodes, 'nonexistent')).toEqual([])
  })
})

describe('findRootId', () => {
  it('finds root node', () => {
    const nodes = createTestTree()
    expect(findRootId(nodes)).toBe('root')
  })

  it('returns undefined for empty nodes', () => {
    expect(findRootId({})).toBeUndefined()
  })
})

describe('hasCircularReference', () => {
  it('detects self-reference', () => {
    const nodes = createTestTree()
    expect(hasCircularReference(nodes, 'a', 'a')).toBe(true)
  })

  it('detects descendant-to-ancestor move', () => {
    const nodes = createTestTree()
    expect(hasCircularReference(nodes, 'a', 'a1')).toBe(true)
    expect(hasCircularReference(nodes, 'a', 'a1x')).toBe(true)
    expect(hasCircularReference(nodes, 'root', 'a1x')).toBe(true)
  })

  it('allows valid moves', () => {
    const nodes = createTestTree()
    expect(hasCircularReference(nodes, 'a1', 'b')).toBe(false)
    expect(hasCircularReference(nodes, 'a2', 'a1')).toBe(false)
  })

  it('returns false for non-existent source node', () => {
    const nodes = createTestTree()
    expect(hasCircularReference(nodes, 'nonexistent', 'a')).toBe(false)
  })
})

describe('isDescendantOf - Deep Trees', () => {
  const createDeepTree = (depth: number): Record<string, NodeData> => {
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Root', children: ['n0'] },
    }
    for (let i = 0; i < depth; i++) {
      const id = `n${i}`
      const nextId = `n${i + 1}`
      nodes[id] = {
        id,
        title: `Node ${i}`,
        parent: i === 0 ? 'root' : `n${i - 1}`,
        children: i < depth - 1 ? [nextId] : [],
      }
    }
    return nodes
  }

  it('handles deep tree traversal (100 levels)', () => {
    const nodes = createDeepTree(100)
    expect(isDescendantOf(nodes, 'n99', 'root')).toBe(true)
    expect(isDescendantOf(nodes, 'n50', 'root')).toBe(true)
    expect(isDescendantOf(nodes, 'n99', 'n50')).toBe(true)
  })
})

describe('getDescendantIds - Wide Trees', () => {
  const createWideTree = (width: number): Record<string, NodeData> => {
    const childIds = Array.from({ length: width }, (_, i) => `child${i}`)
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Root', children: childIds },
    }
    for (const childId of childIds) {
      nodes[childId] = { id: childId, title: childId, parent: 'root', children: [] }
    }
    return nodes
  }

  it('handles wide tree (100 children)', () => {
    const nodes = createWideTree(100)
    const descendants = getDescendantIds(nodes, 'root')
    expect(descendants).toHaveLength(100)
    expect(descendants).toContain('child0')
    expect(descendants).toContain('child99')
  })
})

describe('findRootId - Edge Cases', () => {
  it('returns first root when multiple roots exist (invalid state)', () => {
    const nodes: Record<string, NodeData> = {
      root1: { id: 'root1', title: 'Root 1', children: [] },
      root2: { id: 'root2', title: 'Root 2', children: [] },
    }
    const rootId = findRootId(nodes)
    expect(rootId).toBeDefined()
    expect(['root1', 'root2']).toContain(rootId)
  })

  it('handles node with undefined parent explicitly set', () => {
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Root', parent: undefined, children: [] },
    }
    expect(findRootId(nodes)).toBe('root')
  })
})

describe('getAncestorIds - Edge Cases', () => {
  it('returns empty array for nodes with undefined parent', () => {
    const nodes: Record<string, NodeData> = {
      orphan: { id: 'orphan', title: 'Orphan', children: [] },
    }
    expect(getAncestorIds(nodes, 'orphan')).toEqual([])
  })

  it('handles broken parent chain gracefully', () => {
    const nodes: Record<string, NodeData> = {
      child: { id: 'child', title: 'Child', parent: 'nonexistent', children: [] },
    }
    expect(getAncestorIds(nodes, 'child')).toEqual(['nonexistent'])
  })
})
