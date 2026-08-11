import { describe, expect, it } from 'vitest'
import { getTreeDropPosition, getTreeMoveRequest, type TreeDragBounds } from './tree-drag'

const ROW_BOUNDS: TreeDragBounds = { top: 100, height: 40 }

describe('tree drag position', () => {
  it.each([
    { clientY: 100, expected: 'before' },
    { clientY: 109, expected: 'before' },
    { clientY: 110, expected: 'inside' },
    { clientY: 130, expected: 'inside' },
    { clientY: 131, expected: 'after' },
    { clientY: 140, expected: 'after' },
  ] as const)('maps pointer y=$clientY to $expected insertion zone', ({ clientY, expected }) => {
    expect(getTreeDropPosition(clientY, ROW_BOUNDS)).toBe(expected)
  })
})

describe('tree move request', () => {
  const nodes = {
    root: { children: ['a', 'b', 'c'] },
    a: { parent: 'root', children: [] },
    b: { parent: 'root', children: [] },
    c: { parent: 'root', children: [] },
    parent: { parent: 'root', children: ['child'] },
    child: { parent: 'parent', children: [] },
  }

  it.each([
    { name: 'before an earlier sibling', nodeId: 'c', targetNodeId: 'a', position: 'before', insertionIndex: 0 },
    { name: 'after an earlier sibling', nodeId: 'c', targetNodeId: 'a', position: 'after', insertionIndex: 1 },
    { name: 'before a later sibling', nodeId: 'a', targetNodeId: 'c', position: 'before', insertionIndex: 1 },
    { name: 'after a later sibling', nodeId: 'a', targetNodeId: 'c', position: 'after', insertionIndex: 2 },
  ] as const)(
    'resolves same-parent reorder $name with source removal index adjustment',
    ({ nodeId, targetNodeId, position, insertionIndex }) => {
      expect(getTreeMoveRequest(nodes, nodeId, targetNodeId, position)).toEqual({
        nodeId,
        parentId: 'root',
        insertionIndex,
      })
    },
  )

  it('reparents same-parent inside drops under the target node', () => {
    expect(getTreeMoveRequest(nodes, 'b', 'a', 'inside')).toEqual({
      nodeId: 'b',
      parentId: 'a',
      insertionIndex: 0,
      expandTargetId: 'a',
    })
  })

  it('appends inside drops after existing target children', () => {
    expect(getTreeMoveRequest(nodes, 'c', 'parent', 'inside')).toEqual({
      nodeId: 'c',
      parentId: 'parent',
      insertionIndex: 1,
      expandTargetId: 'parent',
    })
  })

  it('reparents cross-parent inside drops under the target node', () => {
    expect(getTreeMoveRequest(nodes, 'c', 'child', 'inside')).toEqual({
      nodeId: 'c',
      parentId: 'child',
      insertionIndex: 0,
      expandTargetId: 'child',
    })
  })

  it('resolves cross-parent before and after drops beside the target node', () => {
    expect(getTreeMoveRequest(nodes, 'c', 'child', 'before')).toEqual({
      nodeId: 'c',
      parentId: 'parent',
      insertionIndex: 0,
    })
    expect(getTreeMoveRequest(nodes, 'c', 'child', 'after')).toEqual({
      nodeId: 'c',
      parentId: 'parent',
      insertionIndex: 1,
    })
  })

  it.each([
    { name: 'missing source', nodeId: 'missing', targetNodeId: 'a', position: 'before' },
    { name: 'missing target', nodeId: 'a', targetNodeId: 'missing', position: 'before' },
    { name: 'root source without parent', nodeId: 'root', targetNodeId: 'a', position: 'before' },
    { name: 'self move', nodeId: 'a', targetNodeId: 'a', position: 'inside' },
    { name: 'root sibling target has no parent', nodeId: 'a', targetNodeId: 'root', position: 'before' },
  ] as const)('returns undefined for invalid move boundaries: $name', ({ nodeId, targetNodeId, position }) => {
    expect(getTreeMoveRequest(nodes, nodeId, targetNodeId, position)).toBeUndefined()
  })
})
