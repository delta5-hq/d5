import { describe, it, expect } from 'vitest'
import type { NodeData } from '@/shared/base-types/workflow'
import type { FlatTreeData, TreeWalkerYield } from '../types'
import { createTreeWalker } from '../tree-walker'

/* ── Helper: collect all yields from the walker ── */
function collectWalker(treeData: FlatTreeData): TreeWalkerYield[] {
  return [...createTreeWalker(treeData, true)] as TreeWalkerYield[]
}

function collectIds(treeData: FlatTreeData): string[] {
  return [...createTreeWalker(treeData, false)] as string[]
}

function makeNode(id: string, children: string[] = []): NodeData {
  return { id, children } as NodeData
}

/* ─────────────────────────────────────────────────────
 * Empty / missing data guard-rails
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — empty & missing data', () => {
  it('yields nothing when rootId is empty', () => {
    const data: FlatTreeData = { nodes: {}, rootId: '', expandedIds: new Set() }
    expect(collectWalker(data)).toHaveLength(0)
  })

  it('yields nothing when nodes map is empty', () => {
    const data: FlatTreeData = { nodes: {}, rootId: 'root', expandedIds: new Set() }
    expect(collectWalker(data)).toHaveLength(0)
  })

  it('yields nothing when root node is missing from nodes', () => {
    const data: FlatTreeData = { nodes: { other: makeNode('other') }, rootId: 'root', expandedIds: new Set() }
    expect(collectWalker(data)).toHaveLength(0)
  })
})

/* ─────────────────────────────────────────────────────
 * Single root
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — single root', () => {
  it('yields one node for childless root', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r') }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('r')
  })

  it('root is always open regardless of expandedIds', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r', ['c']) }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].isOpen).toBe(true)
  })

  it('root has depth 0', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r') }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].depth).toBe(0)
  })

  it('root has isOpenByDefault = true', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r') }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].isOpenByDefault).toBe(true)
  })

  it('root sparkDelay is 0', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r') }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].sparkDelay).toBe(0)
  })
})

/* ─────────────────────────────────────────────────────
 * DFS ordering
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — DFS traversal order', () => {
  it('visits children in declared order (not reversed)', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b', 'c']),
      a: makeNode('a'),
      b: makeNode('b'),
      c: makeNode('c'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r']) }
    const ids = collectIds(data)
    expect(ids).toEqual(['r', 'a', 'b', 'c'])
  })

  it('visits nested children depth-first', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b']),
      a: makeNode('a', ['a1', 'a2']),
      a1: makeNode('a1'),
      a2: makeNode('a2'),
      b: makeNode('b'),
    }
    const expanded = new Set(['r', 'a'])
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: expanded }
    const ids = collectIds(data)
    expect(ids).toEqual(['r', 'a', 'a1', 'a2', 'b'])
  })

  it('three-level deep tree follows DFS', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['b']),
      b: makeNode('b', ['c']),
      c: makeNode('c'),
    }
    const expanded = new Set(['r', 'a', 'b'])
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: expanded }
    const ids = collectIds(data)
    expect(ids).toEqual(['r', 'a', 'b', 'c'])
  })
})

/* ─────────────────────────────────────────────────────
 * Collapsed subtree handling
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — expansion / collapse', () => {
  const nodes: Record<string, NodeData> = {
    r: makeNode('r', ['a', 'b']),
    a: makeNode('a', ['a1']),
    a1: makeNode('a1'),
    b: makeNode('b'),
  }

  it('collapsed node hides its children', () => {
    /* a is NOT in expandedIds → a1 should not appear */
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const ids = collectIds(data)
    expect(ids).toEqual(['r', 'a', 'b'])
  })

  it('expanded node shows its children', () => {
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['a']) }
    const ids = collectIds(data)
    expect(ids).toEqual(['r', 'a', 'a1', 'b'])
  })

  it('isOpen is false for non-root collapsed node', () => {
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    const nodeA = results.find(n => n.id === 'a')!
    expect(nodeA.isOpen).toBe(false)
    expect(nodeA.hasChildren).toBe(true)
  })

  it('isOpen is true for expanded node', () => {
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['a']) }
    const results = collectWalker(data)
    const nodeA = results.find(n => n.id === 'a')!
    expect(nodeA.isOpen).toBe(true)
  })
})

/* ─────────────────────────────────────────────────────
 * depth tracking
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — depth', () => {
  it('assigns increasing depth to nested children', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['b']),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r', 'a']) }
    const results = collectWalker(data)
    expect(results.map(n => [n.id, n.depth])).toEqual([
      ['r', 0],
      ['a', 1],
      ['b', 2],
    ])
  })

  it('siblings share the same depth', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b', 'c']),
      a: makeNode('a'),
      b: makeNode('b'),
      c: makeNode('c'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    const childDepths = results.filter(n => n.id !== 'r').map(n => n.depth)
    expect(new Set(childDepths).size).toBe(1)
    expect(childDepths[0]).toBe(1)
  })
})

/* ─────────────────────────────────────────────────────
 * hasMoreSiblings
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — hasMoreSiblings', () => {
  it('root has no more siblings', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r') }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].hasMoreSiblings).toBe(false)
  })

  it('last child has hasMoreSiblings = false', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b']),
      a: makeNode('a'),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    const nodeB = results.find(n => n.id === 'b')!
    expect(nodeB.hasMoreSiblings).toBe(false)
  })

  it('non-last child has hasMoreSiblings = true', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b']),
      a: makeNode('a'),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    const nodeA = results.find(n => n.id === 'a')!
    expect(nodeA.hasMoreSiblings).toBe(true)
  })

  it('three siblings: first two true, last false', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b', 'c']),
      a: makeNode('a'),
      b: makeNode('b'),
      c: makeNode('c'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results.find(n => n.id === 'a')!.hasMoreSiblings).toBe(true)
    expect(results.find(n => n.id === 'b')!.hasMoreSiblings).toBe(true)
    expect(results.find(n => n.id === 'c')!.hasMoreSiblings).toBe(false)
  })
})

/* ─────────────────────────────────────────────────────
 * rowsFromParent
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — rowsFromParent', () => {
  it('immediate child of root is 1 row away', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results.find(n => n.id === 'a')!.rowsFromParent).toBe(1)
  })

  it('second sibling after expanded first sibling has larger rowsFromParent', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b']),
      a: makeNode('a', ['a1', 'a2']),
      a1: makeNode('a1'),
      a2: makeNode('a2'),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['a']) }
    const results = collectWalker(data)
    const nodeB = results.find(n => n.id === 'b')!
    /* b is 4 rows after root: r(0), a(1), a1(2), a2(3), b(4) → rowsFromParent = 4 */
    expect(nodeB.rowsFromParent).toBe(4)
  })

  it('deeply nested immediate children are always 1 row from their parent', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['b']),
      b: makeNode('b', ['c']),
      c: makeNode('c'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r', 'a', 'b']) }
    const results = collectWalker(data)
    expect(results.find(n => n.id === 'a')!.rowsFromParent).toBe(1)
    expect(results.find(n => n.id === 'b')!.rowsFromParent).toBe(1)
    expect(results.find(n => n.id === 'c')!.rowsFromParent).toBe(1)
  })

  it('root rowsFromParent defaults to 1 (no parent)', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r') }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].rowsFromParent).toBe(1)
  })
})

/* ─────────────────────────────────────────────────────
 * ancestorContinuation
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — ancestorContinuation', () => {
  it('root has empty ancestorContinuation', () => {
    const data: FlatTreeData = { nodes: { r: makeNode('r') }, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].ancestorContinuation).toEqual([])
  })

  it('children of root have [false] (root has no more siblings)', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results.find(n => n.id === 'a')!.ancestorContinuation).toEqual([false])
  })

  it('grandchild of non-last child carries continuation from parent', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b']),
      a: makeNode('a', ['a1']),
      a1: makeNode('a1'),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['a']) }
    const results = collectWalker(data)
    const a1 = results.find(n => n.id === 'a1')!
    /* root.hasMoreSiblings = false, a.hasMoreSiblings = true */
    expect(a1.ancestorContinuation).toEqual([false, true])
  })

  it('grandchild of last child has false continuation at parent level', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['a1']),
      a1: makeNode('a1'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['a']) }
    const results = collectWalker(data)
    const a1 = results.find(n => n.id === 'a1')!
    /* root.hasMoreSiblings = false, a.hasMoreSiblings = false */
    expect(a1.ancestorContinuation).toEqual([false, false])
  })

  it('continuation length equals depth of the node', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['b']),
      b: makeNode('b', ['c']),
      c: makeNode('c'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r', 'a', 'b']) }
    const results = collectWalker(data)
    for (const node of results) {
      expect(node.ancestorContinuation.length).toBe(node.depth)
    }
  })
})

/* ─────────────────────────────────────────────────────
 * sparkDelay accumulation
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — sparkDelay', () => {
  it('root sparkDelay is always 0', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].sparkDelay).toBe(0)
  })

  it('children at depth 1 have sparkDelay > 0', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results.find(n => n.id === 'a')!.sparkDelay).toBeGreaterThan(0)
  })

  it('sparkDelay is cumulative — deeper nodes have higher delay', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['b']),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['a']) }
    const results = collectWalker(data)
    const delayA = results.find(n => n.id === 'a')!.sparkDelay
    const delayB = results.find(n => n.id === 'b')!.sparkDelay
    expect(delayA).toBeGreaterThan(0)
    expect(delayB).toBeGreaterThan(delayA)
  })

  it('siblings share base delay from parent but differ by their own edge delay', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b']),
      a: makeNode('a'),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    const delayA = results.find(n => n.id === 'a')!.sparkDelay
    const delayB = results.find(n => n.id === 'b')!.sparkDelay
    /* Both are children of root but b is further away (rowsFromParent=2) → higher edge delay */
    expect(delayB).toBeGreaterThan(delayA)
  })

  it('all sparkDelay values are non-negative integers', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'b']),
      a: makeNode('a', ['a1']),
      a1: makeNode('a1'),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['a']) }
    const results = collectWalker(data)
    for (const node of results) {
      expect(node.sparkDelay).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(node.sparkDelay)).toBe(true)
    }
  })
})

/* ─────────────────────────────────────────────────────
 * Circular reference detection
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — circular reference protection', () => {
  it('does not loop infinitely on self-referencing node', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['r']),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r']) }
    const results = collectWalker(data)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('r')
  })

  it('does not loop on mutual cycle', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['r']),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r', 'a']) }
    const results = collectWalker(data)
    expect(results).toHaveLength(2)
    expect(results.map(n => n.id)).toEqual(['r', 'a'])
  })

  it('handles longer cycle without duplication', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['b']),
      b: makeNode('b', ['r']),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r', 'a', 'b']) }
    const results = collectWalker(data)
    expect(results).toHaveLength(3)
    const ids = results.map(n => n.id)
    expect(new Set(ids).size).toBe(3)
  })
})

/* ─────────────────────────────────────────────────────
 * Missing child node graceful skipping
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — missing child nodes', () => {
  it('skips children that do not exist in nodes map', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a', 'missing', 'b']),
      a: makeNode('a'),
      b: makeNode('b'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const ids = collectIds(data)
    expect(ids).toEqual(['r', 'a', 'b'])
  })

  it('skips all children when all are missing', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['x', 'y', 'z']),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set(['r']) }
    const ids = collectIds(data)
    expect(ids).toEqual(['r'])
  })
})

/* ─────────────────────────────────────────────────────
 * refresh=false mode (ID-only yield)
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — refresh=false mode', () => {
  it('yields only node IDs as strings', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectIds(data)
    expect(results).toEqual(['r', 'a'])
    expect(typeof results[0]).toBe('string')
  })
})

/* ─────────────────────────────────────────────────────
 * hasChildren
 * ─────────────────────────────────────────────────────*/

describe('createTreeWalker — hasChildren', () => {
  it('leaf node has hasChildren = false', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results.find(n => n.id === 'a')!.hasChildren).toBe(false)
  })

  it('node with children has hasChildren = true even when collapsed', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', ['a']),
      a: makeNode('a', ['a1']),
      a1: makeNode('a1'),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results.find(n => n.id === 'a')!.hasChildren).toBe(true)
  })

  it('node with empty children array has hasChildren = false', () => {
    const nodes: Record<string, NodeData> = {
      r: makeNode('r', []),
    }
    const data: FlatTreeData = { nodes, rootId: 'r', expandedIds: new Set() }
    const results = collectWalker(data)
    expect(results[0].hasChildren).toBe(false)
  })
})
