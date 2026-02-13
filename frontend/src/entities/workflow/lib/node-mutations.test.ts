import { describe, it, expect } from 'vitest'
import type { NodeData, EdgeData } from '@shared/base-types'
import {
  createRootNode,
  addChildNode,
  updateNode,
  removeNode,
  moveNode,
  duplicateNode,
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
