import { describe, it, expect } from 'vitest'
import { mergeWorkflowNodes } from './merge-workflow-nodes'
import type { WorkflowContentData, NodeData, Share } from '@shared/base-types'
import { AccessRole } from '@shared/base-types'

const mockShare: Share = {
  access: [],
}

describe('mergeWorkflowNodes - Data Integrity', () => {
  it('preserves existing nodes when no changes provided', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Node 1' },
        node2: { id: 'node2', title: 'Node 2' },
      },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {})

    expect(result.nodes).toEqual(current.nodes)
    expect(result).toBe(current)
  })

  it('preserves existing nodes when nodesChanged is undefined', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Node 1' },
      },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, { nodesChanged: undefined })

    expect(result.nodes).toEqual(current.nodes)
  })

  it('merges new nodes into existing nodes', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Node 1' },
      },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {
        node2: { id: 'node2', title: 'Node 2' },
      },
    })

    expect(result.nodes).toEqual({
      node1: { id: 'node1', title: 'Node 1' },
      node2: { id: 'node2', title: 'Node 2' },
    })
  })

  it('overwrites existing node with same ID', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Original' },
      },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {
        node1: { id: 'node1', title: 'Updated' },
      },
    })

    expect(result.nodes.node1.title).toBe('Updated')
  })

  it('preserves unchanged nodes during partial update', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Node 1' },
        node2: { id: 'node2', title: 'Node 2' },
        node3: { id: 'node3', title: 'Node 3' },
      },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {
        node2: { id: 'node2', title: 'Updated Node 2' },
      },
    })

    expect(result.nodes.node1).toEqual(current.nodes.node1)
    expect(result.nodes.node2.title).toBe('Updated Node 2')
    expect(result.nodes.node3).toEqual(current.nodes.node3)
  })
})

describe('mergeWorkflowNodes - Edge Cases', () => {
  it('handles empty current nodes', () => {
    const current: WorkflowContentData = {
      nodes: {},
      root: 'root',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {
        node1: { id: 'node1', title: 'Node 1' },
      },
    })

    expect(result.nodes).toEqual({
      node1: { id: 'node1', title: 'Node 1' },
    })
  })

  it('handles empty nodesChanged', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Node 1' },
      },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {},
    })

    expect(result.nodes).toEqual(current.nodes)
  })

  it('preserves root and share fields', () => {
    const current: WorkflowContentData = {
      nodes: { node1: { id: 'node1' } },
      root: 'node1',
      share: {
        access: [{ subjectId: 'user1', subjectType: 'user', role: AccessRole.owner }],
      },
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: { node2: { id: 'node2' } },
    })

    expect(result.root).toBe('node1')
    expect(result.share).toEqual({
      access: [{ subjectId: 'user1', subjectType: 'user', role: AccessRole.owner }],
    })
  })

  it('preserves edges field if present', () => {
    const current: WorkflowContentData = {
      nodes: { node1: { id: 'node1' } },
      edges: { edge1: { id: 'edge1', start: 'node1', end: 'node2' } },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: { node2: { id: 'node2' } },
    })

    expect(result.edges).toEqual(current.edges)
  })

  it('preserves tags field if present', () => {
    const current: WorkflowContentData = {
      nodes: { node1: { id: 'node1' } },
      root: 'node1',
      share: mockShare,
      tags: [{ id: 'tag1', name: 'Important', color: '#ff0000' }],
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: { node2: { id: 'node2' } },
    })

    expect(result.tags).toEqual(current.tags)
  })

  it('preserves category field if present', () => {
    const current: WorkflowContentData = {
      nodes: { node1: { id: 'node1' } },
      root: 'node1',
      share: mockShare,
      category: 'work',
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: { node2: { id: 'node2' } },
    })

    expect(result.category).toBe('work')
  })
})

describe('mergeWorkflowNodes - Complex Node Updates', () => {
  it('merges node with children array', () => {
    const current: WorkflowContentData = {
      nodes: {
        parent: { id: 'parent', children: ['child1'] },
      },
      root: 'parent',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {
        parent: { id: 'parent', children: ['child1', 'child2'] },
      },
    })

    expect(result.nodes.parent.children).toEqual(['child1', 'child2'])
  })

  it('merges node with nested container config', () => {
    const current: WorkflowContentData = {
      nodes: {
        container: {
          id: 'container',
          container: { type: 'default', childrenIds: ['node1'] },
        },
      },
      root: 'container',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {
        container: {
          id: 'container',
          container: { type: 'default', childrenIds: ['node1', 'node2'] },
        },
      },
    })

    expect(result.nodes.container.container?.childrenIds).toEqual(['node1', 'node2'])
  })

  it('handles multiple concurrent updates', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Title 1' },
        node2: { id: 'node2', title: 'Title 2' },
        node3: { id: 'node3', title: 'Title 3' },
      },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: {
        node1: { id: 'node1', title: 'Updated 1' },
        node2: { id: 'node2', title: 'Updated 2' },
        node4: { id: 'node4', title: 'New Node 4' },
      },
    })

    expect(result.nodes.node1.title).toBe('Updated 1')
    expect(result.nodes.node2.title).toBe('Updated 2')
    expect(result.nodes.node3.title).toBe('Title 3')
    expect(result.nodes.node4.title).toBe('New Node 4')
  })

  it('handles node with all optional fields', () => {
    const fullNode: NodeData = {
      id: 'full',
      title: 'Full Node',
      children: ['child1'],
      prompts: ['prompt1'],
      color: '#ff0000',
      borderColor: '#00ff00',
      scale: 1.5,
      tags: ['tag1', 'tag2'],
      checked: true,
      hasComments: true,
      autoshrink: false,
      dirty: true,
      command: 'test command',
      collapsed: false,
      parent: 'parent1',
    }

    const current: WorkflowContentData = {
      nodes: {},
      root: 'root',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: { full: fullNode },
    })

    expect(result.nodes.full).toEqual(fullNode)
  })
})

describe('mergeWorkflowNodes - Immutability', () => {
  it('does not mutate current workflow data', () => {
    const current: WorkflowContentData = {
      nodes: {
        node1: { id: 'node1', title: 'Original' },
      },
      root: 'node1',
      share: mockShare,
    }

    const originalNodes = { ...current.nodes }

    mergeWorkflowNodes(current, {
      nodesChanged: {
        node1: { id: 'node1', title: 'Updated' },
      },
    })

    expect(current.nodes).toEqual(originalNodes)
  })

  it('does not mutate nodesChanged parameter', () => {
    const current: WorkflowContentData = {
      nodes: { node1: { id: 'node1' } },
      root: 'node1',
      share: mockShare,
    }

    const changes = {
      nodesChanged: {
        node2: { id: 'node2', title: 'New' },
      },
    }

    const originalChanges = { ...changes.nodesChanged }

    mergeWorkflowNodes(current, changes)

    expect(changes.nodesChanged).toEqual(originalChanges)
  })

  it('returns new object reference', () => {
    const current: WorkflowContentData = {
      nodes: { node1: { id: 'node1' } },
      root: 'node1',
      share: mockShare,
    }

    const result = mergeWorkflowNodes(current, {
      nodesChanged: { node2: { id: 'node2' } },
    })

    expect(result).not.toBe(current)
    expect(result.nodes).not.toBe(current.nodes)
  })
})
