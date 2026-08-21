import { describe, it, expect } from 'vitest'
import type { NodeData, EdgeData } from '@shared/base-types'
import {
  createRootNode,
  addChildNode,
  updateNode,
  removeNode,
  moveNode,
  duplicateNode,
  addPromptChild,
  removePromptChildren,
  orphanMatchingPromptChildren,
  wrapNodesInParent,
  NodeMutationError,
} from './node-mutations'

function getError(fn: () => unknown): NodeMutationError {
  try {
    fn()
    throw new Error('Expected function to throw')
  } catch (e) {
    return e as NodeMutationError
  }
}

const createEmptyTree = (): Record<string, NodeData> => ({})

const createSimpleTree = (): Record<string, NodeData> => ({
  root: { id: 'root', title: 'Root', children: ['a', 'b'] },
  a: { id: 'a', title: 'A', parent: 'root', children: ['a1'] },
  b: { id: 'b', title: 'B', parent: 'root', children: [] },
  a1: { id: 'a1', title: 'A1', parent: 'a', children: [] },
})

const createSimpleEdges = (): Record<string, EdgeData> => ({
  'a:b': { id: 'a:b', start: 'a', end: 'b', title: 'edge1' },
  'a:a1': { id: 'a:a1', start: 'a', end: 'a1', title: 'edge2' },
})

describe('createRootNode', () => {
  it('creates root in empty tree', () => {
    const result = createRootNode(createEmptyTree(), { title: 'Root' })
    expect(result.newId).toBeTruthy()
    expect(result.nodes[result.newId].title).toBe('Root')
    expect(result.nodes[result.newId].parent).toBeUndefined()
  })

  it('throws ROOT_EXISTS when root already exists', () => {
    const err = getError(() => createRootNode(createSimpleTree(), { title: 'New Root' }))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('ROOT_EXISTS')
  })

  it('throws ROOT_WITH_PARENT when nodeData has parent', () => {
    const err = getError(() => createRootNode(createEmptyTree(), { title: 'Root', parent: 'x' }))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('ROOT_WITH_PARENT')
  })

  it('throws INVALID_NODE_DATA for invalid node data', () => {
    const err = getError(() => createRootNode(createEmptyTree(), null as never))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('INVALID_NODE_DATA')
  })
})

describe('addChildNode', () => {
  it('adds child to existing parent', () => {
    const nodes = createSimpleTree()
    const result = addChildNode(nodes, 'b', { title: 'B1' })

    expect(result.newId).toBeTruthy()
    expect(result.nodes[result.newId].title).toBe('B1')
    expect(result.nodes[result.newId].parent).toBe('b')
    expect(result.nodes['b'].children).toContain(result.newId)
  })

  it('preserves existing tree', () => {
    const nodes = createSimpleTree()
    const result = addChildNode(nodes, 'root', { title: 'C' })

    expect(result.nodes['a']).toEqual(nodes['a'])
    expect(result.nodes['a1']).toEqual(nodes['a1'])
  })

  it('throws PARENT_NOT_FOUND when parent not found', () => {
    const err = getError(() => addChildNode(createSimpleTree(), 'nonexistent', { title: 'X' }))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('PARENT_NOT_FOUND')
  })

  it('throws INVALID_NODE_DATA for invalid node data', () => {
    const err = getError(() => addChildNode(createSimpleTree(), 'root', { id: 123 as never }))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('INVALID_NODE_DATA')
  })
})

describe('updateNode', () => {
  it('updates title', () => {
    const nodes = createSimpleTree()
    const result = updateNode(nodes, 'a', { title: 'Updated A' })

    expect(result['a'].title).toBe('Updated A')
    expect(result['a'].id).toBe('a')
    expect(result['a'].parent).toBe('root')
  })

  describe('titleProjection lifecycle', () => {
    it('removes stale projection when source title changes', () => {
      const nodes = {
        root: {
          id: 'root',
          title: 'Source',
          children: ['child'],
          titleProjection: { sourceTitle: 'Source', childIds: ['child'], nodeIds: ['child'] },
        },
        child: { id: 'child', title: 'Source', parent: 'root', children: [] },
      }

      const result = updateNode(nodes, 'root', { title: 'Edited' })

      expect(result.root.titleProjection).toBeUndefined()
    })

    it('removes stale projection when projected child is removed', () => {
      const nodes = {
        root: { id: 'root', title: 'Workflow', children: ['parent'] },
        parent: {
          id: 'parent',
          title: 'Source',
          parent: 'root',
          children: ['child'],
          prompts: ['child'],
          titleProjection: { sourceTitle: 'Source', childIds: ['child'], nodeIds: ['child'] },
        },
        child: { id: 'child', title: 'Source', parent: 'parent', children: [] },
      }

      const result = removeNode(nodes, {}, 'child')

      expect(result.nodes.parent.titleProjection).toBeUndefined()
    })

    it('removes stale projection when projected child is reparented', () => {
      const nodes = {
        root: { id: 'root', title: 'Workflow', children: ['parent', 'target'] },
        parent: {
          id: 'parent',
          title: 'Source',
          parent: 'root',
          children: ['child'],
          titleProjection: { sourceTitle: 'Source', childIds: ['child'], nodeIds: ['child'] },
        },
        child: { id: 'child', title: 'Source', parent: 'parent', children: [] },
        target: { id: 'target', title: 'Target', parent: 'root', children: [] },
      }

      const result = moveNode(nodes, 'child', 'target')

      expect(result.parent.titleProjection).toBeUndefined()
    })

    it('removes stale projection when a nested projected line is edited', () => {
      const sourceTitle = 'Heading\n  Detail'
      const nodes = {
        parent: {
          id: 'parent',
          title: sourceTitle,
          children: ['heading'],
          titleProjection: {
            sourceTitle,
            childIds: ['heading'],
            nodeIds: ['heading', 'detail'],
          },
        },
        heading: { id: 'heading', title: 'Heading', parent: 'parent', children: ['detail'] },
        detail: { id: 'detail', title: 'Detail', parent: 'heading', children: [] },
      }

      const result = updateNode(nodes, 'detail', { title: 'Edited detail' })

      expect(result.parent.titleProjection).toBeUndefined()
    })

    it('removes stale projection when a nested projected line is deleted', () => {
      const sourceTitle = 'Heading\n  Detail'
      const nodes = {
        root: { id: 'root', title: 'Workflow', children: ['parent'] },
        parent: {
          id: 'parent',
          title: sourceTitle,
          parent: 'root',
          children: ['heading'],
          titleProjection: {
            sourceTitle,
            childIds: ['heading'],
            nodeIds: ['heading', 'detail'],
          },
        },
        heading: { id: 'heading', title: 'Heading', parent: 'parent', children: ['detail'] },
        detail: { id: 'detail', title: 'Detail', parent: 'heading', children: [] },
      }

      const result = removeNode(nodes, {}, 'detail')

      expect(result.nodes.parent.titleProjection).toBeUndefined()
    })

    it('removes stale projection when nested projected siblings are reordered', () => {
      const sourceTitle = 'Heading\n  First\n  Second'
      const nodes = {
        parent: {
          id: 'parent',
          title: sourceTitle,
          children: ['heading'],
          titleProjection: {
            sourceTitle,
            childIds: ['heading'],
            nodeIds: ['heading', 'first', 'second'],
          },
        },
        heading: { id: 'heading', title: 'Heading', parent: 'parent', children: ['first', 'second'] },
        first: { id: 'first', title: 'First', parent: 'heading', children: [] },
        second: { id: 'second', title: 'Second', parent: 'heading', children: [] },
      }

      const result = moveNode(nodes, 'second', 'heading', 0)

      expect(result.parent.titleProjection).toBeUndefined()
    })

    it('remaps projection child ids when duplicating a projected subtree', () => {
      const nodes = {
        root: { id: 'root', title: 'Workflow', children: ['parent'] },
        parent: {
          id: 'parent',
          title: 'Source',
          parent: 'root',
          children: ['child'],
          titleProjection: { sourceTitle: 'Source', childIds: ['child'], nodeIds: ['child'] },
        },
        child: { id: 'child', title: 'Source', parent: 'parent', children: [] },
      }

      const result = duplicateNode(nodes, {}, 'parent')
      const duplicate = result.nodes[result.newRootId]

      expect(duplicate.titleProjection).toEqual({
        sourceTitle: 'Source',
        childIds: duplicate.children,
        nodeIds: duplicate.children,
      })
    })
  })

  it('updates command', () => {
    const nodes = createSimpleTree()
    const result = updateNode(nodes, 'a', { command: '/instruct test' })

    expect(result['a'].command).toBe('/instruct test')
  })

  it('preserves id and parent even if provided', () => {
    const nodes = createSimpleTree()
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = updateNode(nodes, 'a', { id: 'hacked', parent: 'hacked' } as any)
    /* eslint-enable @typescript-eslint/no-explicit-any */

    expect(result['a'].id).toBe('a')
    expect(result['a'].parent).toBe('root')
  })

  it('throws NODE_NOT_FOUND when node not found', () => {
    const err = getError(() => updateNode(createSimpleTree(), 'nonexistent', { title: 'X' }))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('NODE_NOT_FOUND')
  })
})

describe('removeNode', () => {
  it('removes leaf node', () => {
    const nodes = createSimpleTree()
    const result = removeNode(nodes, {}, 'b')

    expect(result.nodes['b']).toBeUndefined()
    expect(result.nodes['root'].children).not.toContain('b')
    expect(result.removedNodeIds).toEqual(['b'])
  })

  it('removes node with descendants', () => {
    const nodes = createSimpleTree()
    const result = removeNode(nodes, {}, 'a')

    expect(result.nodes['a']).toBeUndefined()
    expect(result.nodes['a1']).toBeUndefined()
    expect(result.nodes['root'].children).not.toContain('a')
    expect(result.removedNodeIds).toContain('a')
    expect(result.removedNodeIds).toContain('a1')
  })

  it('removes connected edges', () => {
    const nodes = createSimpleTree()
    const edges = createSimpleEdges()
    const result = removeNode(nodes, edges, 'a')

    expect(result.edges['a:b']).toBeUndefined()
    expect(result.edges['a:a1']).toBeUndefined()
  })

  it('throws CANNOT_REMOVE_ROOT when removing root', () => {
    const err = getError(() => removeNode(createSimpleTree(), {}, 'root'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('CANNOT_REMOVE_ROOT')
  })

  it('throws NODE_NOT_FOUND when node not found', () => {
    const err = getError(() => removeNode(createSimpleTree(), {}, 'nonexistent'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('NODE_NOT_FOUND')
  })
})

describe('moveNode', () => {
  it('moves node to different parent', () => {
    const nodes = createSimpleTree()
    const result = moveNode(nodes, 'a1', 'b')

    expect(result['a1'].parent).toBe('b')
    expect(result['a'].children).not.toContain('a1')
    expect(result['b'].children).toContain('a1')
  })

  it('returns same nodes when moving to same parent', () => {
    const nodes = createSimpleTree()
    const result = moveNode(nodes, 'a', 'root')

    expect(result).toEqual(nodes)
  })

  it('reorders node within the same parent at requested index', () => {
    const nodes = createSimpleTree()
    const result = moveNode(nodes, 'b', 'root', 0)

    expect(result['root'].children).toEqual(['b', 'a'])
    expect(result['b'].parent).toBe('root')
  })

  it.each([
    { nodeId: 'a', insertionIndex: 1, expectedChildren: ['b', 'a'] },
    { nodeId: 'b', insertionIndex: 0, expectedChildren: ['b', 'a'] },
    { nodeId: 'a', insertionIndex: 0, expectedChildren: ['a', 'b'] },
    { nodeId: 'b', insertionIndex: 1, expectedChildren: ['a', 'b'] },
  ])('handles same-parent reorder boundaries %#', ({ nodeId, insertionIndex, expectedChildren }) => {
    const nodes = createSimpleTree()
    const result = moveNode(nodes, nodeId, 'root', insertionIndex)

    expect(result['root'].children).toEqual(expectedChildren)
    expect(result[nodeId].parent).toBe('root')
  })

  it('inserts moved node into target parent at requested index', () => {
    const nodes = createSimpleTree()
    const result = moveNode(nodes, 'a1', 'root', 1)

    expect(result['a'].children).toEqual([])
    expect(result['root'].children).toEqual(['a', 'a1', 'b'])
    expect(result['a1'].parent).toBe('root')
  })

  it('clamps insertion index to target sibling bounds', () => {
    const nodes = createSimpleTree()

    expect(moveNode(nodes, 'a1', 'root', -5)['root'].children).toEqual(['a1', 'a', 'b'])
    expect(moveNode(nodes, 'a1', 'root', 99)['root'].children).toEqual(['a', 'b', 'a1'])
  })

  it('does not duplicate source id when reordering or reparenting', () => {
    const sameParent = moveNode(createSimpleTree(), 'a', 'root', 1)
    const crossParent = moveNode(createSimpleTree(), 'a1', 'root', 1)

    expect(sameParent['root'].children.filter(id => id === 'a')).toHaveLength(1)
    expect(crossParent['root'].children.filter(id => id === 'a1')).toHaveLength(1)
  })

  it('throws CIRCULAR_REFERENCE for self parent', () => {
    const err = getError(() => moveNode(createSimpleTree(), 'a', 'a'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('CIRCULAR_REFERENCE')
  })

  it('throws CIRCULAR_REFERENCE for descendant parent', () => {
    const err = getError(() => moveNode(createSimpleTree(), 'a', 'a1'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('CIRCULAR_REFERENCE')
  })

  it('throws CANNOT_MOVE_ROOT when moving root', () => {
    const err = getError(() => moveNode(createSimpleTree(), 'root', 'a'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('CANNOT_MOVE_ROOT')
  })

  it('throws TARGET_NOT_FOUND when target not found', () => {
    const err = getError(() => moveNode(createSimpleTree(), 'a', 'nonexistent'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('TARGET_NOT_FOUND')
  })

  it('throws NODE_NOT_FOUND when source not found', () => {
    const err = getError(() => moveNode(createSimpleTree(), 'nonexistent', 'b'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('NODE_NOT_FOUND')
  })
})

describe('duplicateNode', () => {
  it('duplicates leaf node', () => {
    const nodes = createSimpleTree()
    const result = duplicateNode(nodes, {}, 'b')

    expect(result.newRootId).toBeTruthy()
    expect(result.newRootId).not.toBe('b')
    expect(result.nodes[result.newRootId].title).toBe('B')
    expect(result.nodes[result.newRootId].parent).toBe('root')
    expect(result.nodes['root'].children).toContain(result.newRootId)
  })

  it('duplicates subtree with descendants', () => {
    const nodes = createSimpleTree()
    const result = duplicateNode(nodes, {}, 'a')

    const newA = result.nodes[result.newRootId]
    expect(newA.title).toBe('A')
    expect(newA.children).toHaveLength(1)

    const newA1Id = newA.children![0]
    expect(result.nodes[newA1Id].title).toBe('A1')
    expect(result.nodes[newA1Id].parent).toBe(result.newRootId)
  })

  it('duplicates projected prompt ownership so removing the copy cannot delete the source subtree', () => {
    const sourceTitle = 'Heading\n  Detail'
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Workflow', children: ['source'] },
      source: {
        id: 'source',
        title: sourceTitle,
        parent: 'root',
        children: ['heading'],
        prompts: ['heading'],
        titleProjection: {
          sourceTitle,
          childIds: ['heading'],
          nodeIds: ['heading', 'detail'],
        },
      },
      heading: { id: 'heading', title: 'Heading', parent: 'source', children: ['detail'] },
      detail: { id: 'detail', title: 'Detail', parent: 'heading', children: [] },
    }

    const duplicated = duplicateNode(nodes, {}, 'source')
    const copy = duplicated.nodes[duplicated.newRootId]
    const copyHeadingId = duplicated.idMapping.heading
    const copyDetailId = duplicated.idMapping.detail

    expect(copy.prompts).toEqual([copyHeadingId])
    expect(copy.titleProjection).toEqual({
      sourceTitle,
      childIds: [copyHeadingId],
      nodeIds: [copyHeadingId, copyDetailId],
    })

    const afterRemovingCopyPrompts = removePromptChildren(duplicated.nodes, duplicated.newRootId)

    expect(afterRemovingCopyPrompts[copyHeadingId]).toBeUndefined()
    expect(afterRemovingCopyPrompts[copyDetailId]).toBeUndefined()
    expect(afterRemovingCopyPrompts.heading).toBe(nodes.heading)
    expect(afterRemovingCopyPrompts.detail).toBe(nodes.detail)
  })

  it('duplicates to different parent', () => {
    const nodes = createSimpleTree()
    const result = duplicateNode(nodes, {}, 'a1', 'b')

    expect(result.nodes[result.newRootId].parent).toBe('b')
    expect(result.nodes['b'].children).toContain(result.newRootId)
  })

  it('duplicates internal edges', () => {
    const nodes = createSimpleTree()
    const edges: Record<string, EdgeData> = {
      'a:a1': { id: 'a:a1', start: 'a', end: 'a1' },
    }
    const result = duplicateNode(nodes, edges, 'a')

    const newEdgeId = `${result.newRootId}:${result.idMapping['a1']}`
    expect(result.edges[newEdgeId]).toBeDefined()
    expect(result.edges[newEdgeId].start).toBe(result.newRootId)
  })

  it('returns id mapping', () => {
    const nodes = createSimpleTree()
    const result = duplicateNode(nodes, {}, 'a')

    expect(result.idMapping['a']).toBe(result.newRootId)
    expect(result.idMapping['a1']).toBeTruthy()
    expect(result.idMapping['a1']).not.toBe('a1')
  })

  it('throws NO_TARGET_PARENT when duplicating root without target', () => {
    const err = getError(() => duplicateNode(createSimpleTree(), {}, 'root'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('NO_TARGET_PARENT')
  })

  it('throws NODE_NOT_FOUND when source not found', () => {
    const err = getError(() => duplicateNode(createSimpleTree(), {}, 'nonexistent'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('NODE_NOT_FOUND')
  })

  it('throws TARGET_NOT_FOUND when explicit target parent missing', () => {
    const err = getError(() => duplicateNode(createSimpleTree(), {}, 'a', 'nonexistent'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('TARGET_NOT_FOUND')
  })

  it('does not duplicate external edges', () => {
    const nodes = createSimpleTree()
    const edges: Record<string, EdgeData> = {
      'root:a': { id: 'root:a', start: 'root', end: 'a' },
      'a:a1': { id: 'a:a1', start: 'a', end: 'a1' },
    }
    const result = duplicateNode(nodes, edges, 'a')

    const newEdgeKeys = Object.keys(result.edges).filter(k => !edges[k])
    expect(newEdgeKeys).toHaveLength(1)
    expect(result.edges[newEdgeKeys[0]].start).toBe(result.newRootId)
  })
})

describe('Immutability Guarantees', () => {
  it('createRootNode does not mutate original nodes', () => {
    const original = createEmptyTree()
    const originalCopy = { ...original }
    createRootNode(original, { title: 'Root' })
    expect(original).toEqual(originalCopy)
  })

  it('addChildNode does not mutate original nodes', () => {
    const original = createSimpleTree()
    const originalCopy = JSON.parse(JSON.stringify(original))
    addChildNode(original, 'a', { title: 'New' })
    expect(original).toEqual(originalCopy)
  })

  it('updateNode does not mutate original nodes', () => {
    const original = createSimpleTree()
    const originalCopy = JSON.parse(JSON.stringify(original))
    updateNode(original, 'a', { title: 'Updated' })
    expect(original).toEqual(originalCopy)
  })

  it('removeNode does not mutate original nodes or edges', () => {
    const originalNodes = createSimpleTree()
    const originalEdges = createSimpleEdges()
    const nodesCopy = JSON.parse(JSON.stringify(originalNodes))
    const edgesCopy = JSON.parse(JSON.stringify(originalEdges))
    removeNode(originalNodes, originalEdges, 'a')
    expect(originalNodes).toEqual(nodesCopy)
    expect(originalEdges).toEqual(edgesCopy)
  })

  it('moveNode does not mutate original nodes', () => {
    const original = createSimpleTree()
    const originalCopy = JSON.parse(JSON.stringify(original))
    moveNode(original, 'a1', 'b')
    expect(original).toEqual(originalCopy)
  })

  it('duplicateNode does not mutate original nodes or edges', () => {
    const originalNodes = createSimpleTree()
    const originalEdges = createSimpleEdges()
    const nodesCopy = JSON.parse(JSON.stringify(originalNodes))
    const edgesCopy = JSON.parse(JSON.stringify(originalEdges))
    duplicateNode(originalNodes, originalEdges, 'a')
    expect(originalNodes).toEqual(nodesCopy)
    expect(originalEdges).toEqual(edgesCopy)
  })
})

describe('createRootNode - Edge Cases', () => {
  it('preserves extra properties from nodeData', () => {
    const result = createRootNode(createEmptyTree(), {
      title: 'Root',
      command: '/instruct',
    })
    expect(result.nodes[result.newId].command).toBe('/instruct')
  })

  it('initializes empty children array when not provided', () => {
    const result = createRootNode(createEmptyTree(), { title: 'Root' })
    expect(result.nodes[result.newId].children).toEqual([])
  })
})

describe('addChildNode - Edge Cases', () => {
  it('handles parent with undefined children', () => {
    const nodes: Record<string, NodeData> = {
      root: { id: 'root', title: 'Root' },
    }
    const result = addChildNode(nodes, 'root', { title: 'Child' })
    expect(result.nodes['root'].children).toContain(result.newId)
  })

  it('preserves existing children order', () => {
    const nodes = createSimpleTree()
    const result = addChildNode(nodes, 'a', { title: 'A2' })
    expect(result.nodes['a'].children).toEqual(['a1', result.newId])
  })
})

describe('updateNode - Edge Cases', () => {
  it('preserves children array reference integrity', () => {
    const nodes = createSimpleTree()
    const result = updateNode(nodes, 'a', { title: 'Updated' })
    expect(result['a'].children).toEqual(nodes['a'].children)
  })

  it('allows updating to empty title', () => {
    const nodes = createSimpleTree()
    const result = updateNode(nodes, 'a', { title: '' })
    expect(result['a'].title).toBe('')
  })

  it('preserves unspecified fields', () => {
    const nodes: Record<string, NodeData> = {
      a: { id: 'a', title: 'A', command: '/instruct', children: [] },
    }
    const result = updateNode(nodes, 'a', { title: 'Updated' })
    expect(result['a'].command).toBe('/instruct')
  })

  it('throws INVALID_NODE_DATA for invalid updates', () => {
    const err = getError(() => updateNode(createSimpleTree(), 'a', { title: 123 } as never))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('INVALID_NODE_DATA')
  })
})

describe('removeNode - Edge Cases', () => {
  it('removes all edges connected to removed subtree', () => {
    const nodes = createSimpleTree()
    const edges: Record<string, EdgeData> = {
      'root:a': { id: 'root:a', start: 'root', end: 'a' },
      'a:a1': { id: 'a:a1', start: 'a', end: 'a1' },
      'b:a': { id: 'b:a', start: 'b', end: 'a' },
      'a1:b': { id: 'a1:b', start: 'a1', end: 'b' },
    }
    const result = removeNode(nodes, edges, 'a')

    expect(result.edges['root:a']).toBeUndefined()
    expect(result.edges['a:a1']).toBeUndefined()
    expect(result.edges['b:a']).toBeUndefined()
    expect(result.edges['a1:b']).toBeUndefined()
  })

  it('preserves edges not connected to removed nodes', () => {
    const nodes = createSimpleTree()
    const edges: Record<string, EdgeData> = {
      'root:b': { id: 'root:b', start: 'root', end: 'b' },
    }
    const result = removeNode(nodes, edges, 'a')
    expect(result.edges['root:b']).toBeDefined()
  })

  it('updates parent children list correctly after removal', () => {
    const nodes = createSimpleTree()
    const result = removeNode(nodes, {}, 'a')
    expect(result.nodes['root'].children).toEqual(['b'])
  })
})

describe('duplicateNode - Deep Subtrees', () => {
  const createDeepSubtree = (): Record<string, NodeData> => ({
    root: { id: 'root', title: 'Root', children: ['a'] },
    a: { id: 'a', title: 'A', parent: 'root', children: ['a1'] },
    a1: { id: 'a1', title: 'A1', parent: 'a', children: ['a2'] },
    a2: { id: 'a2', title: 'A2', parent: 'a1', children: ['a3'] },
    a3: { id: 'a3', title: 'A3', parent: 'a2', children: [] },
  })

  it('duplicates deep subtree preserving hierarchy', () => {
    const nodes = createDeepSubtree()
    const result = duplicateNode(nodes, {}, 'a')

    expect(result.idMapping['a']).toBe(result.newRootId)
    const newA1 = result.nodes[result.idMapping['a1']]
    const newA2 = result.nodes[result.idMapping['a2']]
    const newA3 = result.nodes[result.idMapping['a3']]

    expect(newA1.parent).toBe(result.newRootId)
    expect(newA2.parent).toBe(result.idMapping['a1'])
    expect(newA3.parent).toBe(result.idMapping['a2'])
  })

  it('all duplicated IDs are unique from originals', () => {
    const nodes = createDeepSubtree()
    const result = duplicateNode(nodes, {}, 'a')
    const originalIds = new Set(Object.keys(nodes))

    for (const newId of Object.values(result.idMapping)) {
      expect(originalIds.has(newId)).toBe(false)
    }
  })
})

describe('addPromptChild', () => {
  it('registers new child in both children and prompts arrays', () => {
    const nodes = createSimpleTree()
    const result = addPromptChild(nodes, 'a', { title: 'Prompt Result' })

    expect(result.nodes[result.newId].parent).toBe('a')
    expect(result.nodes[result.newId].title).toBe('Prompt Result')
    expect(result.nodes.a.children).toContain(result.newId)
    expect(result.nodes.a.prompts).toContain(result.newId)
  })

  it('appends to existing prompts array', () => {
    const nodes = createSimpleTree()
    nodes.a.prompts = ['existing-prompt']
    const result = addPromptChild(nodes, 'a', { title: 'New' })

    expect(result.nodes.a.prompts).toEqual(['existing-prompt', result.newId])
  })

  it('initializes prompts array when undefined', () => {
    const nodes = createSimpleTree()
    delete nodes.a.prompts
    const result = addPromptChild(nodes, 'a', { title: 'Test' })

    expect(result.nodes.a.prompts).toEqual([result.newId])
  })

  it('does not modify input prompts', () => {
    const nodes = createSimpleTree()
    addPromptChild(nodes, 'a', { title: 'Test' })

    expect(nodes.a.prompts).toBeUndefined()
  })
})

describe('removePromptChildren', () => {
  it('removes prompt nodes and cleans parent arrays', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['regular', 'p1', 'p2'], prompts: ['p1', 'p2'] },
      regular: { id: 'regular', parent: 'parent', children: [] },
      p1: { id: 'p1', parent: 'parent', children: [] },
      p2: { id: 'p2', parent: 'parent', children: [] },
    }

    const result = removePromptChildren(nodes, 'parent')

    expect(result.p1).toBeUndefined()
    expect(result.p2).toBeUndefined()
    expect(result.regular).toBeDefined()
    expect(result.parent.children).toEqual(['regular'])
    expect(result.parent.prompts).toEqual([])
  })

  it('preserves non-prompt children order', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['c1', 'p1', 'c2', 'p2', 'c3'], prompts: ['p1', 'p2'] },
      c1: { id: 'c1', parent: 'parent', children: [] },
      c2: { id: 'c2', parent: 'parent', children: [] },
      c3: { id: 'c3', parent: 'parent', children: [] },
      p1: { id: 'p1', parent: 'parent', children: [] },
      p2: { id: 'p2', parent: 'parent', children: [] },
    }

    const result = removePromptChildren(nodes, 'parent')

    expect(result.parent.children).toEqual(['c1', 'c2', 'c3'])
  })

  it('cascade-deletes prompt descendants', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['p1'], prompts: ['p1'] },
      p1: { id: 'p1', parent: 'parent', children: ['grandchild'] },
      grandchild: { id: 'grandchild', parent: 'p1', children: ['deep'] },
      deep: { id: 'deep', parent: 'grandchild', children: [] },
    }

    const result = removePromptChildren(nodes, 'parent')

    expect(result.p1).toBeUndefined()
    expect(result.grandchild).toBeUndefined()
    expect(result.deep).toBeUndefined()
  })

  it('returns same reference when no prompts exist', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['regular'] },
      regular: { id: 'regular', parent: 'parent', children: [] },
    }

    expect(removePromptChildren(nodes, 'parent')).toBe(nodes)
  })

  it('returns same reference for empty prompts array', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: [], prompts: [] },
    }

    expect(removePromptChildren(nodes, 'parent')).toBe(nodes)
  })

  it('handles prompt listed in prompts but not in children', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['regular'], prompts: ['orphan'] },
      regular: { id: 'regular', parent: 'parent', children: [] },
      orphan: { id: 'orphan', parent: 'parent', children: [] },
    }

    const result = removePromptChildren(nodes, 'parent')

    expect(result.orphan).toBeUndefined()
    expect(result.parent.children).toEqual(['regular'])
  })

  it('handles prompt ID pointing to nonexistent node', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['ghost'], prompts: ['ghost'] },
    }

    const result = removePromptChildren(nodes, 'parent')

    expect(result.parent.children).toEqual([])
    expect(result.parent.prompts).toEqual([])
  })

  it('does not modify input nodes', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['p1'], prompts: ['p1'] },
      p1: { id: 'p1', parent: 'parent', children: [] },
    }

    removePromptChildren(nodes, 'parent')

    expect(nodes.parent.children).toEqual(['p1'])
    expect(nodes.parent.prompts).toEqual(['p1'])
    expect(nodes.p1).toBeDefined()
  })

  it('preserves unrelated nodes', () => {
    const nodes: Record<string, NodeData> = {
      parent: { id: 'parent', children: ['p1'], prompts: ['p1'] },
      p1: { id: 'p1', parent: 'parent', children: [] },
      sibling: { id: 'sibling', children: [] },
    }

    const result = removePromptChildren(nodes, 'parent')

    expect(result.sibling).toBe(nodes.sibling)
  })

  it('throws PARENT_NOT_FOUND when parent not found', () => {
    const err = getError(() => removePromptChildren({}, 'missing'))
    expect(err).toBeInstanceOf(NodeMutationError)
    expect(err.code).toBe('PARENT_NOT_FOUND')
  })
})

describe('orphanMatchingPromptChildren', () => {
  function makeTreeWithPrompts(): Record<string, NodeData> {
    return {
      root: { id: 'root', title: 'Root', children: ['p1', 'p2', 'regular'], prompts: ['p1', 'p2'] },
      p1: { id: 'p1', title: 'Paragraph one', parent: 'root', children: [] },
      p2: { id: 'p2', title: 'Paragraph two', parent: 'root', children: [] },
      regular: { id: 'regular', title: 'Regular child', parent: 'root', children: [] },
    }
  }

  describe('prompt tracking update', () => {
    it('removes matched prompt id from parent.prompts while keeping unmatched ids', () => {
      const nodes = makeTreeWithPrompts()
      const result = orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one']))
      expect(result['root'].prompts).toEqual(['p2'])
    })

    it('clears parent.prompts entirely when every prompt title matches', () => {
      const nodes = makeTreeWithPrompts()
      const result = orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one', 'Paragraph two']))
      expect(result['root'].prompts).toEqual([])
    })
  })

  describe('node and children preservation', () => {
    it('retains matched prompt node in nodes map after orphaning', () => {
      const nodes = makeTreeWithPrompts()
      const result = orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one']))
      expect(result['p1']).toBeDefined()
    })

    it('retains matched prompt node in parent.children after orphaning', () => {
      const nodes = makeTreeWithPrompts()
      const result = orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one']))
      expect(result['root'].children).toContain('p1')
    })

    it('does not cascade into descendants of an orphaned prompt node', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: ['p1'], prompts: ['p1'] },
        p1: { id: 'p1', title: 'Para', parent: 'root', children: ['p1child'] },
        p1child: { id: 'p1child', title: 'Deep', parent: 'p1', children: [] },
      }
      const result = orphanMatchingPromptChildren(nodes, 'root', new Set(['Para']))
      expect(result['p1child']).toBeDefined()
    })

    it('leaves non-prompt children in parent.children and nodes map untouched', () => {
      const nodes = makeTreeWithPrompts()
      const result = orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one']))
      expect(result['root'].children).toContain('regular')
      expect(result['regular']).toBe(nodes['regular'])
    })

    it('leaves unrelated sibling nodes untouched', () => {
      const nodes = makeTreeWithPrompts()
      const unrelated: Record<string, NodeData> = { ...nodes, sibling: { id: 'sibling', children: [] } }
      const result = orphanMatchingPromptChildren(unrelated, 'root', new Set(['Paragraph one']))
      expect(result['sibling']).toBe(unrelated['sibling'])
    })

    it('handles prompt id listed in prompts but absent from nodes map', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: [], prompts: ['ghost'] },
      }
      const result = orphanMatchingPromptChildren(nodes, 'root', new Set(['any title']))
      expect(result).toBe(nodes)
    })
  })

  describe('identity / no-op conditions', () => {
    it('returns same reference when no prompts match', () => {
      const nodes = makeTreeWithPrompts()
      expect(orphanMatchingPromptChildren(nodes, 'root', new Set(['No match']))).toBe(nodes)
    })

    it('returns same reference when incoming title set is empty', () => {
      const nodes = makeTreeWithPrompts()
      expect(orphanMatchingPromptChildren(nodes, 'root', new Set())).toBe(nodes)
    })

    it('returns same reference when parent.prompts is absent', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: ['c1'] },
        c1: { id: 'c1', title: 'Child', parent: 'root', children: [] },
      }
      expect(orphanMatchingPromptChildren(nodes, 'root', new Set(['Child']))).toBe(nodes)
    })

    it('returns same reference when parent.prompts is an empty array', () => {
      const nodes: Record<string, NodeData> = {
        root: { id: 'root', title: 'Root', children: [], prompts: [] },
      }
      expect(orphanMatchingPromptChildren(nodes, 'root', new Set(['anything']))).toBe(nodes)
    })

    it('does not match on title substring — only exact match', () => {
      const nodes = makeTreeWithPrompts()
      expect(orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph']))).toBe(nodes)
    })

    it('does not match on title superset — only exact match', () => {
      const nodes = makeTreeWithPrompts()
      expect(orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one extra']))).toBe(nodes)
    })
  })

  describe('immutability', () => {
    it('does not mutate parent.prompts on the original nodes', () => {
      const nodes = makeTreeWithPrompts()
      const originalPrompts = [...(nodes['root'].prompts ?? [])]
      orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one']))
      expect(nodes['root'].prompts).toEqual(originalPrompts)
    })

    it('does not mutate parent.children on the original nodes', () => {
      const nodes = makeTreeWithPrompts()
      const originalChildren = [...(nodes['root'].children ?? [])]
      orphanMatchingPromptChildren(nodes, 'root', new Set(['Paragraph one']))
      expect(nodes['root'].children).toEqual(originalChildren)
    })
  })

  describe('error handling', () => {
    it('throws PARENT_NOT_FOUND when parent does not exist', () => {
      const err = getError(() => orphanMatchingPromptChildren({}, 'missing', new Set(['x'])))
      expect(err).toBeInstanceOf(NodeMutationError)
      expect(err.code).toBe('PARENT_NOT_FOUND')
    })
  })
})

describe('wrapNodesInParent', () => {
  const makeTree = (): Record<string, NodeData> => ({
    root: { id: 'root', title: 'Root', parent: undefined, children: ['a', 'b', 'c'] },
    a: { id: 'a', title: 'A', parent: 'root', children: [] },
    b: { id: 'b', title: 'B', parent: 'root', children: [] },
    c: { id: 'c', title: 'C', parent: 'root', children: [] },
  })

  const emptyEdges: Record<string, EdgeData> = {}

  describe('new parent shape', () => {
    it('new parent has empty title and is parented to original parent', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['a'])
      expect(nodes[newParentId].title).toBe('')
      expect(nodes[newParentId].parent).toBe('root')
    })

    it('new parent children list contains exactly the wrapped nodes', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['a', 'b'])
      expect(nodes[newParentId].children).toEqual(['a', 'b'])
    })

    it('wrapped nodes are reparented to new parent', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['a', 'b'])
      expect(nodes['a'].parent).toBe(newParentId)
      expect(nodes['b'].parent).toBe(newParentId)
    })
  })

  describe('insertion position', () => {
    it('new parent is inserted at position of first wrapped node (first two)', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['a', 'b'])
      expect(nodes['root'].children.indexOf(newParentId)).toBe(0)
    })

    it('new parent is inserted at position of first wrapped node (middle two)', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['b', 'c'])
      expect(nodes['root'].children.indexOf(newParentId)).toBe(1)
    })

    it('non-wrapped siblings remain in original parent', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['a', 'b'])
      expect(nodes['root'].children).toEqual([newParentId, 'c'])
    })
  })

  describe('ordering', () => {
    it('wrapped nodes appear in parent-children order regardless of input order', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['c', 'a'])
      expect(nodes[newParentId].children).toEqual(['a', 'c'])
    })

    it('single-node wrap places exactly that node under new parent', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['b'])
      expect(nodes[newParentId].children).toEqual(['b'])
      expect(nodes['b'].parent).toBe(newParentId)
    })

    it('wrapping all children leaves original parent with only new parent', () => {
      const { nodes, newParentId } = wrapNodesInParent(makeTree(), emptyEdges, ['a', 'b', 'c'])
      expect(nodes['root'].children).toEqual([newParentId])
    })
  })

  describe('edges passthrough', () => {
    it('returns the same edges reference when no edges are removed', () => {
      const { edges } = wrapNodesInParent(makeTree(), emptyEdges, ['a'])
      expect(edges).toBe(emptyEdges)
    })
  })

  describe('error handling', () => {
    it('throws NODE_NOT_FOUND for empty nodeIds array', () => {
      const err = getError(() => wrapNodesInParent(makeTree(), emptyEdges, []))
      expect(err).toBeInstanceOf(NodeMutationError)
      expect(err.code).toBe('NODE_NOT_FOUND')
    })

    it('throws NODE_NOT_FOUND when a nodeId does not exist in nodes', () => {
      const err = getError(() => wrapNodesInParent(makeTree(), emptyEdges, ['missing']))
      expect(err).toBeInstanceOf(NodeMutationError)
      expect(err.code).toBe('NODE_NOT_FOUND')
    })

    it('throws CANNOT_MOVE_ROOT when first node has no parent', () => {
      const nodes = { root: { id: 'root', title: 'Root', children: [] } }
      const err = getError(() => wrapNodesInParent(nodes, emptyEdges, ['root']))
      expect(err).toBeInstanceOf(NodeMutationError)
      expect(err.code).toBe('CANNOT_MOVE_ROOT')
    })

    it('throws PARENT_NOT_FOUND when nodeIds span different parents', () => {
      const tree = makeTree()
      tree['a'] = { ...tree['a'], parent: 'other' }
      const err = getError(() => wrapNodesInParent(tree, emptyEdges, ['a', 'b']))
      expect(err).toBeInstanceOf(NodeMutationError)
      expect(err.code).toBe('PARENT_NOT_FOUND')
    })
  })

  describe('immutability', () => {
    it('does not mutate original parent children array', () => {
      const original = makeTree()
      const before = [...original['root'].children!]
      wrapNodesInParent(original, emptyEdges, ['a', 'b'])
      expect(original['root'].children).toEqual(before)
    })

    it('does not mutate wrapped node parent field on original', () => {
      const original = makeTree()
      wrapNodesInParent(original, emptyEdges, ['a', 'b'])
      expect(original['a'].parent).toBe('root')
    })
  })
})
