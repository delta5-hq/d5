import { describe, it, expect } from 'vitest'
import { computeSegments, getSegmentHeight, getSegmentCount, getSegmentByNodeId } from './segment-computer'
import type { TreeState } from '../core/types'
import type { SegmentComputeOptions } from './types'
import type { NodeData } from '@/shared/base-types/workflow'

const DEFAULT_OPTIONS: SegmentComputeOptions = {
  rowHeight: 32,
}

function createTreeState(
  nodes: Array<{
    id: string
    depth: number
    isOpen?: boolean
    children?: string[]
    container?: unknown
    command?: string
    rowsFromParent?: number
  }>,
): TreeState {
  const records: TreeState['records'] = {}
  const order: string[] = []

  nodes.forEach(node => {
    const isOpen = node.isOpen ?? false
    order.push(node.id)
    records[node.id] = {
      id: node.id,
      isOpen,
      data: {
        id: node.id,
        depth: node.depth,
        isOpen,
        isOpenByDefault: false,
        hasChildren: (node.children?.length ?? 0) > 0,
        hasMoreSiblings: false,
        ancestorContinuation: [],
        rowsFromParent: node.rowsFromParent ?? 1,
        sparkDelay: 0,
        node: {
          id: node.id,
          children: node.children || [],
          ...(node.container ? { container: node.container } : {}),
          ...(node.command ? { command: node.command } : {}),
        } as NodeData,
      },
    }
  })

  return { records, order }
}

describe('computeSegments - Node Transformation', () => {
  it('should transform single node to single segment', () => {
    const treeState = createTreeState([{ id: 'root', depth: 0 }])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]).toEqual({
      type: 'node',
      data: treeState.records.root.data,
      rowIndex: 0,
    })
    expect(result.segmentHeights[0]).toBe(32)
  })

  it('should transform multiple nodes to multiple segments', () => {
    const treeState = createTreeState([
      { id: 'root', depth: 0 },
      { id: 'child1', depth: 1 },
      { id: 'child2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(3)
    expect(result.segments.every(s => s.type === 'node')).toBe(true)
    expect(result.segmentHeights).toEqual([32, 32, 32])
  })

  it('should preserve node order from tree state', () => {
    const treeState = createTreeState([
      { id: 'a', depth: 0 },
      { id: 'b', depth: 0 },
      { id: 'c', depth: 0 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments.map(s => (s.type === 'node' ? s.data.id : 'container'))).toEqual(['a', 'b', 'c'])
  })
})

describe('computeSegments - Container Grouping', () => {
  it('should create container segment when node has container config and is open with children', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['child1', 'child2'], container: { component: 'Card' } },
      { id: 'child1', depth: 1 },
      { id: 'child2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].parentNode.id).toBe('parent')
      expect(result.segments[0].parentTreeNode.id).toBe('parent')
      expect(result.segments[0].children).toHaveLength(2)
      expect(result.segments[0].children.map(c => c.id)).toEqual(['child1', 'child2'])
    }
  })

  it('should not create container when node is collapsed', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: false, children: ['child1'], container: { component: 'Card' } },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('node')
  })

  it('should not create container when node has no children', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: [], container: { component: 'Card' } },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('node')
  })

  it('should not create container when node has no container config', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['child1'] },
      { id: 'child1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(2)
    expect(result.segments.every(s => s.type === 'node')).toBe(true)
  })
})

describe('computeSegments - Nested Container Handling', () => {
  it('should not create container when first child has container config', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['child1', 'child2'], container: { component: 'Card' } },
      { id: 'child1', depth: 1, container: { component: 'Panel' } },
      { id: 'child2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]?.type).toBe('node')
    if (result.segments[0]?.type === 'node') {
      expect(result.segments[0].data.id).toBe('parent')
    }
    expect(result.segments[1]?.type).toBe('node')
    expect(result.segments[2]?.type).toBe('node')
  })

  it('should create container when non-container children come before nested container', () => {
    const treeState = createTreeState([
      { id: 'a', depth: 0, isOpen: true, children: ['a2', 'a1'], container: { component: 'Card' } },
      { id: 'a2', depth: 1 },
      { id: 'a1', depth: 1, isOpen: true, children: ['a1a', 'a1b'], container: { component: 'Panel' } },
      { id: 'a1a', depth: 2 },
      { id: 'a1b', depth: 2 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(2)

    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].parentNode.id).toBe('a')
      expect(result.segments[0].children.map(c => c.id)).toEqual(['a2'])
    }

    expect(result.segments[1]?.type).toBe('container')
    if (result.segments[1]?.type === 'container') {
      expect(result.segments[1].parentNode.id).toBe('a1')
      expect(result.segments[1].children.map(c => c.id)).toEqual(['a1a', 'a1b'])
    }
  })

  it('should not create containers when all children have container configs', () => {
    const treeState = createTreeState([
      { id: 'root', depth: 0, isOpen: true, children: ['l1'], container: { component: 'Card' } },
      { id: 'l1', depth: 1, isOpen: true, children: ['l2'], container: { component: 'Panel' } },
      { id: 'l2', depth: 2, isOpen: true, children: ['l3'], container: { component: 'Box' } },
      { id: 'l3', depth: 3 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(3)
    expect(result.segments[0]?.type).toBe('node')
    if (result.segments[0]?.type === 'node') {
      expect(result.segments[0].data.id).toBe('root')
    }
    expect(result.segments[1]?.type).toBe('node')
    if (result.segments[1]?.type === 'node') {
      expect(result.segments[1].data.id).toBe('l1')
    }
    expect(result.segments[2]?.type).toBe('container')
    if (result.segments[2]?.type === 'container') {
      expect(result.segments[2].parentNode.id).toBe('l2')
      expect(result.segments[2].children.map(c => c.id)).toEqual(['l3'])
    }
  })
})

describe('computeSegments - Mixed Siblings', () => {
  it('should handle mixed container and non-container siblings', () => {
    const treeState = createTreeState([
      { id: 'root', depth: 0, isOpen: true, children: ['a', 'b', 'c'] },
      { id: 'a', depth: 1, isOpen: true, children: ['a1'], container: { component: 'Card' } },
      { id: 'a1', depth: 2 },
      { id: 'b', depth: 1 },
      { id: 'c', depth: 1, isOpen: true, children: ['c1'], container: { component: 'Panel' } },
      { id: 'c1', depth: 2 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(4)
    expect(result.segments[0]?.type).toBe('node')
    expect(result.segments[1]?.type).toBe('container')
    expect(result.segments[2]?.type).toBe('node')
    expect(result.segments[3]?.type).toBe('container')
  })

  it('should preserve depth information in mixed structures', () => {
    const treeState = createTreeState([
      { id: 'root', depth: 0, isOpen: true, children: ['a', 'b'] },
      { id: 'a', depth: 1, isOpen: true, children: ['a1', 'a2'], container: { component: 'Card' } },
      { id: 'a1', depth: 2 },
      { id: 'a2', depth: 2 },
      { id: 'b', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('node')
    if (result.segments[0]?.type === 'node') {
      expect(result.segments[0].data.depth).toBe(0)
    }

    expect(result.segments[1]?.type).toBe('container')
    if (result.segments[1]?.type === 'container') {
      expect(result.segments[1].depth).toBe(1)
      expect(result.segments[1].children.every(c => c.depth === 2)).toBe(true)
    }

    expect(result.segments[2]?.type).toBe('node')
    if (result.segments[2]?.type === 'node') {
      expect(result.segments[2].data.depth).toBe(1)
    }
  })
})

describe('computeSegments - Height Calculation', () => {
  it('should calculate container height with default padding', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['c1', 'c2'], container: { component: 'Card' } },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    const expectedHeight = 32 + 8 + 2 * 32 + 8
    expect(result.segmentHeights[0]).toBe(expectedHeight)
  })

  it('should use custom padding when provided', () => {
    const treeState = createTreeState([
      {
        id: 'parent',
        depth: 0,
        isOpen: true,
        children: ['c1'],
        container: { component: 'Card', paddingTop: 16, paddingBottom: 24 },
      },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    const expectedHeight = 32 + 16 + 32 + 24
    expect(result.segmentHeights[0]).toBe(expectedHeight)
  })

  it('should respect custom row height option', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['c1', 'c2'], container: { component: 'Card' } },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
    ])

    const result = computeSegments(treeState, { rowHeight: 48 })

    const expectedHeight = 48 + 8 + 2 * 48 + 8
    expect(result.segmentHeights[0]).toBe(expectedHeight)
  })

  it('should handle container with many children', () => {
    const children = Array.from({ length: 10 }, (_, i) => `child${i}`)
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children, container: { component: 'Card' } },
      ...children.map(id => ({ id, depth: 1 })),
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    const expectedHeight = 32 + 8 + 10 * 32 + 8
    expect(result.segmentHeights[0]).toBe(expectedHeight)
  })
})

describe('computeSegments - Node to Segment Index Mapping', () => {
  it('should map single node to segment index', () => {
    const treeState = createTreeState([{ id: 'root', depth: 0 }])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.nodeToSegmentIndex.get('root')).toBe(0)
  })

  it('should map all nodes in linear structure', () => {
    const treeState = createTreeState([
      { id: 'a', depth: 0 },
      { id: 'b', depth: 0 },
      { id: 'c', depth: 0 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.nodeToSegmentIndex.get('a')).toBe(0)
    expect(result.nodeToSegmentIndex.get('b')).toBe(1)
    expect(result.nodeToSegmentIndex.get('c')).toBe(2)
  })

  it('should map parent and children in container to same segment index', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['c1', 'c2'], container: { component: 'Card' } },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.nodeToSegmentIndex.get('parent')).toBe(0)
    expect(result.nodeToSegmentIndex.get('c1')).toBe(0)
    expect(result.nodeToSegmentIndex.get('c2')).toBe(0)
  })

  it('should maintain correct indices with mixed structures', () => {
    const treeState = createTreeState([
      { id: 'a', depth: 0 },
      { id: 'b', depth: 0, isOpen: true, children: ['b1', 'b2'], container: { component: 'Card' } },
      { id: 'b1', depth: 1 },
      { id: 'b2', depth: 1 },
      { id: 'c', depth: 0 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.nodeToSegmentIndex.get('a')).toBe(0)
    expect(result.nodeToSegmentIndex.get('b')).toBe(1)
    expect(result.nodeToSegmentIndex.get('b1')).toBe(1)
    expect(result.nodeToSegmentIndex.get('b2')).toBe(1)
    expect(result.nodeToSegmentIndex.get('c')).toBe(2)
  })
})

describe('computeSegments - Edge Cases', () => {
  it('should handle empty tree state', () => {
    const treeState: TreeState = { records: {}, order: [] }

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(0)
    expect(result.segmentHeights).toHaveLength(0)
    expect(result.nodeToSegmentIndex.size).toBe(0)
  })

  it('should handle missing node record gracefully', () => {
    const treeState: TreeState = {
      records: {},
      order: ['missing-node'],
    }

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(0)
  })

  it('should not create container when children are non-existent', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['nonexistent'], container: { component: 'Card' } },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('node')
    if (result.segments[0]?.type === 'node') {
      expect(result.segments[0].data.id).toBe('parent')
    }
  })

  it('should handle duplicate node IDs in order array', () => {
    const treeState: TreeState = {
      records: {
        a: {
          id: 'a',
          isOpen: false,
          data: {
            id: 'a',
            depth: 0,
            isOpen: false,
            isOpenByDefault: false,
            hasChildren: false,
            hasMoreSiblings: false,
            ancestorContinuation: [],
            rowsFromParent: 1,
            sparkDelay: 0,
            node: { id: 'a', children: [] },
          },
        },
      },
      order: ['a', 'a'],
    }

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
  })

  it('should handle zero row height', () => {
    const treeState = createTreeState([{ id: 'root', depth: 0 }])

    const result = computeSegments(treeState, { rowHeight: 0 })

    expect(result.segmentHeights[0]).toBe(0)
  })

  it('should handle container with only non-immediate children', () => {
    const treeState: TreeState = {
      records: {
        parent: {
          id: 'parent',
          isOpen: true,
          data: {
            id: 'parent',
            depth: 0,
            isOpen: true,
            isOpenByDefault: false,
            hasChildren: true,
            hasMoreSiblings: false,
            ancestorContinuation: [],
            rowsFromParent: 1,
            sparkDelay: 0,
            node: {
              id: 'parent',
              children: ['child1'],
              container: { component: 'Card' },
            } as any,
          },
        },
        child1: {
          id: 'child1',
          isOpen: false,
          data: {
            id: 'child1',
            depth: 1,
            isOpen: false,
            isOpenByDefault: false,
            hasChildren: false,
            hasMoreSiblings: false,
            ancestorContinuation: [],
            rowsFromParent: 1,
            sparkDelay: 0,
            node: { id: 'child1', children: [] },
          },
        },
        unrelated: {
          id: 'unrelated',
          isOpen: false,
          data: {
            id: 'unrelated',
            depth: 1,
            isOpen: false,
            isOpenByDefault: false,
            hasChildren: false,
            hasMoreSiblings: false,
            ancestorContinuation: [],
            rowsFromParent: 1,
            sparkDelay: 0,
            node: { id: 'unrelated', children: [] },
          },
        },
      },
      order: ['parent', 'unrelated', 'child1'],
    }

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments.length).toBeGreaterThan(0)
  })
})

describe('getSegmentHeight', () => {
  it('should return correct height for valid index', () => {
    const segmentState = {
      segments: [],
      segmentHeights: [32, 100, 48],
      nodeToSegmentIndex: new Map(),
    }

    expect(getSegmentHeight(segmentState, 0)).toBe(32)
    expect(getSegmentHeight(segmentState, 1)).toBe(100)
    expect(getSegmentHeight(segmentState, 2)).toBe(48)
  })

  it('should return 0 for out-of-bounds index', () => {
    const segmentState = {
      segments: [],
      segmentHeights: [32],
      nodeToSegmentIndex: new Map(),
    }

    expect(getSegmentHeight(segmentState, 10)).toBe(0)
    expect(getSegmentHeight(segmentState, -1)).toBe(0)
  })
})

describe('getSegmentCount', () => {
  it('should return correct segment count', () => {
    const segmentState = {
      segments: [{} as any, {} as any, {} as any],
      segmentHeights: [32, 32, 32],
      nodeToSegmentIndex: new Map(),
    }

    expect(getSegmentCount(segmentState)).toBe(3)
  })

  it('should return 0 for empty segment state', () => {
    const segmentState = {
      segments: [],
      segmentHeights: [],
      nodeToSegmentIndex: new Map(),
    }

    expect(getSegmentCount(segmentState)).toBe(0)
  })
})

describe('getSegmentByNodeId', () => {
  it('should return segment and index for existing node', () => {
    const segment = { type: 'node' as const, data: { id: 'test' } as any, rowIndex: 0 }
    const segmentState = {
      segments: [segment],
      segmentHeights: [32],
      nodeToSegmentIndex: new Map([['test', 0]]),
    }

    const result = getSegmentByNodeId(segmentState, 'test')

    expect(result).not.toBeNull()
    expect(result?.segment).toBe(segment)
    expect(result?.index).toBe(0)
  })

  it('should return null for non-existent node', () => {
    const segmentState = {
      segments: [],
      segmentHeights: [],
      nodeToSegmentIndex: new Map(),
    }

    const result = getSegmentByNodeId(segmentState, 'missing')

    expect(result).toBeNull()
  })

  it('should return null when index points to non-existent segment', () => {
    const segmentState = {
      segments: [],
      segmentHeights: [],
      nodeToSegmentIndex: new Map([['orphan', 99]]),
    }

    const result = getSegmentByNodeId(segmentState, 'orphan')

    expect(result).toBeNull()
  })

  it('should find correct segment in container mapping', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['c1', 'c2'], container: { component: 'Card' } },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
    ])

    const segmentState = computeSegments(treeState, DEFAULT_OPTIONS)

    const parentResult = getSegmentByNodeId(segmentState, 'parent')
    const c1Result = getSegmentByNodeId(segmentState, 'c1')
    const c2Result = getSegmentByNodeId(segmentState, 'c2')

    expect(parentResult?.index).toBe(0)
    expect(c1Result?.index).toBe(0)
    expect(c2Result?.index).toBe(0)
    expect(parentResult?.segment).toBe(c1Result?.segment)
    expect(parentResult?.segment).toBe(c2Result?.segment)
  })
})

describe('computeSegments - Partial Container Children', () => {
  it('should include only specified children in container', () => {
    const treeState = createTreeState([
      {
        id: 'parent',
        depth: 0,
        isOpen: true,
        children: ['c1', 'c2', 'c3'],
        container: { type: 'card', childrenIds: ['c1', 'c2'] },
      },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
      { id: 'c3', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    /* Container with parent + c1 + c2 */
    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].children).toHaveLength(2)
      expect(result.segments[0].children[0].id).toBe('c1')
      expect(result.segments[0].children[1].id).toBe('c2')
    }

    /* c3 should be a separate segment */
    expect(result.segments[1]?.type).toBe('node')
    if (result.segments[1]?.type === 'node') {
      expect(result.segments[1].data.id).toBe('c3')
    }
  })

  it('should include all children when childrenIds not specified', () => {
    const treeState = createTreeState([
      {
        id: 'parent',
        depth: 0,
        isOpen: true,
        children: ['c1', 'c2'],
        container: { type: 'card' },
      },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].children).toHaveLength(2)
    }
  })

  it('should calculate height correctly for partial container', () => {
    const treeState = createTreeState([
      {
        id: 'parent',
        depth: 0,
        isOpen: true,
        children: ['c1', 'c2', 'c3'],
        container: { type: 'card', childrenIds: ['c1', 'c2'], paddingTop: 4, paddingBottom: 4 },
      },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
      { id: 'c3', depth: 1 },
    ])

    const result = computeSegments(treeState, { rowHeight: 32 })

    /* Container: parent(32) + paddingTop(4) + 2*children(64) + paddingBottom(4) = 104 */
    expect(result.segmentHeights[0]).toBe(104)
    /* c3 node: 32 */
    expect(result.segmentHeights[1]).toBe(32)
  })
})

describe('computeSegments - Parent Node Rendering', () => {
  it('should include parent node in container segment', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['c1'], container: { type: 'card' } },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].parentNode).toBeDefined()
      expect(result.segments[0].parentNode.id).toBe('parent')
      expect(result.segments[0].parentTreeNode).toBeDefined()
      expect(result.segments[0].parentTreeNode.id).toBe('parent')
    }
  })

  it('should preserve parent node data structure', () => {
    const treeState = createTreeState([
      { id: 'parent', depth: 0, isOpen: true, children: ['c1'], container: { type: 'card' } },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].parentTreeNode).toEqual(treeState.records.parent.data)
    }
  })

  it('should include parent height in container height calculation', () => {
    const treeState = createTreeState([
      {
        id: 'parent',
        depth: 0,
        isOpen: true,
        children: ['c1'],
        container: { type: 'card', paddingTop: 0, paddingBottom: 0 },
      },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, { rowHeight: 40 })

    const expectedHeight = 40 + 0 + 40 + 0
    expect(result.segmentHeights[0]).toBe(expectedHeight)
  })
})

/* ──────────────────────────────────────────────────────────
 * Implicit container via node command
 * ──────────────────────────────────────────────────────────*/

describe('computeSegments — Implicit Container from Command', () => {
  it('creates container for open /foreach node with children', () => {
    const treeState = createTreeState([
      { id: 'fe', depth: 0, isOpen: true, children: ['c1', 'c2'], command: '/foreach' },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].parentNode.id).toBe('fe')
      expect(result.segments[0].children.map(c => c.id)).toEqual(['c1', 'c2'])
    }
  })

  it('does NOT create container for collapsed /foreach node', () => {
    const treeState = createTreeState([{ id: 'fe', depth: 0, isOpen: false, children: ['c1'], command: '/foreach' }])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('node')
  })

  it('does NOT create container for /foreach node with no children', () => {
    const treeState = createTreeState([{ id: 'fe', depth: 0, isOpen: true, children: [], command: '/foreach' }])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.type).toBe('node')
  })

  it('applies synthetic padding to /foreach container height', () => {
    const treeState = createTreeState([
      { id: 'fe', depth: 0, isOpen: true, children: ['c1'], command: '/foreach' },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    /* Synthetic config: paddingTop=6, paddingBottom=6 */
    const expectedHeight = 32 + 6 + 32 + 6
    expect(result.segmentHeights[0]).toBe(expectedHeight)
  })

  it('explicit container config takes precedence over command detection', () => {
    const treeState = createTreeState([
      {
        id: 'fe',
        depth: 0,
        isOpen: true,
        children: ['c1'],
        command: '/foreach',
        container: { type: 'card', paddingTop: 20, paddingBottom: 20 },
      },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('container')
    const expectedHeight = 32 + 20 + 32 + 20
    expect(result.segmentHeights[0]).toBe(expectedHeight)
  })

  it('non-foreach commands do not get synthetic containers', () => {
    const treeState = createTreeState([
      { id: 'cmd', depth: 0, isOpen: true, children: ['c1'], command: '/other' },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(2)
    expect(result.segments.every(s => s.type === 'node')).toBe(true)
  })

  it('node without command and without container is a plain node', () => {
    const treeState = createTreeState([
      { id: 'plain', depth: 0, isOpen: true, children: ['c1'] },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments).toHaveLength(2)
    expect(result.segments.every(s => s.type === 'node')).toBe(true)
  })

  it('maps /foreach parent and children to same segment index', () => {
    const treeState = createTreeState([
      { id: 'fe', depth: 0, isOpen: true, children: ['c1', 'c2'], command: '/foreach' },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.nodeToSegmentIndex.get('fe')).toBe(0)
    expect(result.nodeToSegmentIndex.get('c1')).toBe(0)
    expect(result.nodeToSegmentIndex.get('c2')).toBe(0)
  })

  it('stops container at child with its own container config', () => {
    const treeState = createTreeState([
      { id: 'fe', depth: 0, isOpen: true, children: ['c1', 'c2'], command: '/foreach' },
      { id: 'c1', depth: 1 },
      { id: 'c2', depth: 1, isOpen: true, children: ['c2a'], container: { type: 'card' } },
      { id: 'c2a', depth: 2 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].children.map(c => c.id)).toEqual(['c1'])
    }
    /* c2 becomes its own container */
    expect(result.segments[1]?.type).toBe('container')
    if (result.segments[1]?.type === 'container') {
      expect(result.segments[1].parentNode.id).toBe('c2')
    }
  })

  it('stops container at child that is also a /foreach', () => {
    const treeState = createTreeState([
      { id: 'fe1', depth: 0, isOpen: true, children: ['c1', 'fe2'], command: '/foreach' },
      { id: 'c1', depth: 1 },
      { id: 'fe2', depth: 1, isOpen: true, children: ['c2'], command: '/foreach' },
      { id: 'c2', depth: 2 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].parentNode.id).toBe('fe1')
      expect(result.segments[0].children.map(c => c.id)).toEqual(['c1'])
    }
    expect(result.segments[1]?.type).toBe('container')
    if (result.segments[1]?.type === 'container') {
      expect(result.segments[1].parentNode.id).toBe('fe2')
    }
  })
})

/* ──────────────────────────────────────────────────────────
 * includeParent config propagation
 * ──────────────────────────────────────────────────────────*/

describe('computeSegments — includeParent Config', () => {
  it('synthetic /foreach container carries includeParent: true', () => {
    const treeState = createTreeState([
      { id: 'fe', depth: 0, isOpen: true, children: ['c1'], command: '/foreach' },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].config.includeParent).toBe(true)
    }
  })

  it('explicit container without includeParent defaults to undefined/falsy', () => {
    const treeState = createTreeState([
      { id: 'p', depth: 0, isOpen: true, children: ['c1'], container: { type: 'card' } },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].config.includeParent).toBeFalsy()
    }
  })

  it('explicit container with includeParent: true propagates it', () => {
    const treeState = createTreeState([
      {
        id: 'p',
        depth: 0,
        isOpen: true,
        children: ['c1'],
        container: { type: 'group', includeParent: true },
      },
      { id: 'c1', depth: 1 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.segments[0]?.type).toBe('container')
    if (result.segments[0]?.type === 'container') {
      expect(result.segments[0].config.includeParent).toBe(true)
    }
  })
})

/* ──────────────────────────────────────────────────────────
 * Mixed: implicit + explicit containers in the same tree
 * ──────────────────────────────────────────────────────────*/

describe('computeSegments — Mixed Implicit and Explicit Containers', () => {
  it('coexists: explicit container sibling of /foreach container', () => {
    const treeState = createTreeState([
      { id: 'root', depth: 0, isOpen: true, children: ['fe', 'ex'] },
      { id: 'fe', depth: 1, isOpen: true, children: ['f1'], command: '/foreach' },
      { id: 'f1', depth: 2 },
      { id: 'ex', depth: 1, isOpen: true, children: ['e1'], container: { type: 'card' } },
      { id: 'e1', depth: 2 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    /* root is a plain node, fe is container, ex is container */
    expect(result.segments[0]?.type).toBe('node')
    expect(result.segments[1]?.type).toBe('container')
    expect(result.segments[2]?.type).toBe('container')

    if (result.segments[1]?.type === 'container') {
      expect(result.segments[1].parentNode.id).toBe('fe')
      expect(result.segments[1].config.includeParent).toBe(true)
    }
    if (result.segments[2]?.type === 'container') {
      expect(result.segments[2].parentNode.id).toBe('ex')
      expect(result.segments[2].config.includeParent).toBeFalsy()
    }
  })

  it('three consecutive containers maintain correct segment indices', () => {
    const treeState = createTreeState([
      { id: 'r', depth: 0, isOpen: true, children: ['a', 'b', 'c'] },
      { id: 'a', depth: 1, isOpen: true, children: ['a1'], command: '/foreach' },
      { id: 'a1', depth: 2 },
      { id: 'b', depth: 1, isOpen: true, children: ['b1'], container: { type: 'highlight' } },
      { id: 'b1', depth: 2 },
      { id: 'c', depth: 1, isOpen: true, children: ['c1'], command: '/foreach' },
      { id: 'c1', depth: 2 },
    ])

    const result = computeSegments(treeState, DEFAULT_OPTIONS)

    expect(result.nodeToSegmentIndex.get('r')).toBe(0)
    expect(result.nodeToSegmentIndex.get('a')).toBe(1)
    expect(result.nodeToSegmentIndex.get('a1')).toBe(1)
    expect(result.nodeToSegmentIndex.get('b')).toBe(2)
    expect(result.nodeToSegmentIndex.get('b1')).toBe(2)
    expect(result.nodeToSegmentIndex.get('c')).toBe(3)
    expect(result.nodeToSegmentIndex.get('c1')).toBe(3)
  })
})
