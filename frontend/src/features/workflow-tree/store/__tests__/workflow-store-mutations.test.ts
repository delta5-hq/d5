import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from '@shared/lib/store'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { bindMutationActions, type FormatMessage } from '../workflow-store-mutations'
import type { DebouncedPersister } from '../workflow-store-persistence'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }))

const { MockNodeMutationError } = vi.hoisted(() => ({
  MockNodeMutationError: class extends Error {
    code: string
    constructor(msg: string, code: string) {
      super(msg)
      this.code = code
      this.name = 'NodeMutationError'
    }
  },
}))

vi.mock('@entities/workflow/lib', async importOriginal => {
  const actual = await importOriginal<typeof import('@entities/workflow/lib')>()
  return {
    ...actual,
    createRootNode: vi.fn((_nodes: unknown, data: Record<string, unknown>) => ({
      nodes: { 'new-root': { id: 'new-root', title: data.title ?? '', children: [] } },
      newId: 'new-root',
    })),
    addChildNode: vi.fn((_nodes: unknown, _parentId: string, data: Record<string, unknown>) => ({
      nodes: {
        p1: { id: 'p1', children: ['new-child'] },
        'new-child': { id: 'new-child', title: data.title ?? '', parent: 'p1', children: [] },
      },
      newId: 'new-child',
    })),
    updateNode: vi.fn((_nodes: unknown, nodeId: string, updates: Record<string, unknown>) => ({
      [nodeId]: { id: nodeId, ...updates },
    })),
    removeNode: vi.fn((_nodes: unknown, edges: unknown, _nodeId: string) => ({
      nodes: {},
      edges,
      removedNodeIds: [_nodeId],
    })),
    moveNode: vi.fn((_nodes: unknown) => ({ moved: true })),
    duplicateNode: vi.fn((_nodes: unknown, edges: unknown) => ({
      nodes: {},
      edges,
      newRootId: 'dup-root',
      idMapping: {},
    })),
    NodeMutationError: MockNodeMutationError,
  }
})

function makeStore(overrides: Partial<WorkflowStoreState> = {}) {
  return createStore<WorkflowStoreState>({
    ...INITIAL_WORKFLOW_STATE,
    workflowId: 'wf-test',
    ...overrides,
  })
}

function makePersister(): DebouncedPersister {
  return { schedule: vi.fn(), flush: vi.fn(), cancel: vi.fn(), destroy: vi.fn() }
}

function makeHistory() {
  return { checkpoint: vi.fn(), undo: vi.fn(), redo: vi.fn(), clear: vi.fn() }
}

const mockFormatMessage: FormatMessage = (d: { id: string }) => d.id

describe('bindMutationActions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('createRoot adds node and marks dirty', () => {
    const store = makeStore()
    const persister = makePersister()
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const newId = createRoot({ title: 'Root' })

    expect(newId).toBe('new-root')
    expect(store.getState().nodes).toHaveProperty('new-root')
    expect(store.getState().root).toBe('new-root')
    expect(store.getState().isDirty).toBe(true)
    expect(persister.schedule).toHaveBeenCalledOnce()
  })

  it('addChild adds child node', () => {
    const store = makeStore({ nodes: { p1: { id: 'p1', children: [] } } as WorkflowStoreState['nodes'] })
    const persister = makePersister()
    const { addChild } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const newId = addChild('p1', { title: 'Child' })

    expect(newId).toBe('new-child')
    expect(store.getState().isDirty).toBe(true)
  })

  describe('addSibling', () => {
    it('adds sibling by creating child under parent', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['n1'] },
          n1: { id: 'n1', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { addSibling } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const newId = addSibling('n1', { title: 'Sibling' })

      expect(newId).toBe('new-child')
      expect(store.getState().isDirty).toBe(true)
      expect(persister.schedule).toHaveBeenCalledOnce()
    })

    it('returns null when node has no parent', () => {
      const store = makeStore({
        nodes: { root: { id: 'root', children: [] } } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { addSibling } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const newId = addSibling('root', { title: 'Sibling' })

      expect(newId).toBeNull()
      expect(store.getState().isDirty).toBe(false)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('returns null when node does not exist', () => {
      const store = makeStore({ nodes: {} })
      const persister = makePersister()
      const { addSibling } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const newId = addSibling('ghost', { title: 'Sibling' })

      expect(newId).toBeNull()
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('creates sibling with provided data', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['n1'] },
          n1: { id: 'n1', parent: 'root', command: '/test', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { addSibling } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const newId = addSibling('n1', { title: 'New Sibling', command: '/new' })

      expect(newId).toBe('new-child')
      expect(store.getState().isDirty).toBe(true)
    })
  })

  describe('updateNode', () => {
    it('applies field changes, marks store dirty, and adds nodeId to dirtyNodeIds', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', title: 'old' } } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { updateNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const ok = updateNode('n1', { title: 'new' })

      expect(ok).toBe(true)
      expect(store.getState().isDirty).toBe(true)
      expect(store.getState().dirtyNodeIds).toEqual(new Set(['n1']))
    })

    it('accumulates dirtyNodeIds across distinct nodes', () => {
      const store = makeStore({
        nodes: {
          n1: { id: 'n1', title: 'a' },
          n2: { id: 'n2', title: 'b' },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { updateNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      updateNode('n1', { title: 'a2' })
      updateNode('n2', { title: 'b2' })

      expect(store.getState().dirtyNodeIds).toEqual(new Set(['n1', 'n2']))
    })

    it('is idempotent when the same node is updated multiple times', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', title: 'a' } } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { updateNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      updateNode('n1', { title: 'b' })
      updateNode('n1', { title: 'c' })

      expect(store.getState().dirtyNodeIds).toEqual(new Set(['n1']))
    })

    it('does not modify dirtyNodeIds when the mutation throws', async () => {
      const { updateNode: updateNodePure } = await import('@entities/workflow/lib')
      vi.mocked(updateNodePure).mockImplementationOnce(() => {
        throw new MockNodeMutationError('not found', 'NODE_NOT_FOUND')
      })

      const store = makeStore({
        nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { updateNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      updateNode('n1', { title: 'x' })

      expect(store.getState().dirtyNodeIds).toEqual(new Set())
    })
  })

  describe('removeNode dirtyNodeIds eviction', () => {
    it('removes the deleted nodeId from dirtyNodeIds while preserving others', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
        dirtyNodeIds: new Set(['n1', 'n2']),
      })
      const persister = makePersister()
      const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNode('n1')

      expect(store.getState().dirtyNodeIds).toEqual(new Set(['n2']))
    })

    it('leaves dirtyNodeIds unchanged when the deleted node was not dirty', () => {
      const initialDirtyNodeIds = new Set(['n2'])
      const store = makeStore({
        nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
        dirtyNodeIds: initialDirtyNodeIds,
      })
      const persister = makePersister()
      const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNode('n1')

      expect(store.getState().dirtyNodeIds).toEqual(new Set(['n2']))
    })
  })

  describe('removeNodes dirtyNodeIds eviction', () => {
    it('evicts all cascade-removed nodeIds and preserves surviving dirty nodes', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: [] } },
        edges: {},
        removedNodeIds: ['a', 'b'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        dirtyNodeIds: new Set(['a', 'b', 'c']),
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a', 'b']))

      expect(store.getState().dirtyNodeIds).toEqual(new Set(['c']))
    })

    it('leaves dirtyNodeIds empty when no dirty nodes existed before removal', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: [] } },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a'] },
          a: { id: 'a', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a']))

      expect(store.getState().dirtyNodeIds).toEqual(new Set())
    })
  })

  it('removeNode removes node', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const ok = removeNode('n1')

    expect(ok).toBe(true)
  })

  it('removeNode selects parent when deleted node has no siblings', () => {
    const store = makeStore({
      nodes: {
        root: { id: 'root', children: ['n1'] },
        n1: { id: 'n1', parent: 'root', children: [] },
      } as WorkflowStoreState['nodes'],
      selectedId: 'n1',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().selectedId).toBe('root')
  })

  it('removeNode selects next sibling when deleted node has one', () => {
    const store = makeStore({
      nodes: {
        root: { id: 'root', children: ['n1', 'n2'] },
        n1: { id: 'n1', parent: 'root', children: [] },
        n2: { id: 'n2', parent: 'root', children: [] },
      } as WorkflowStoreState['nodes'],
      selectedId: 'n1',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().selectedId).toBe('n2')
  })

  it('removeNode preserves selectedId when selected node is not among removedNodeIds', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' }, n2: { id: 'n2', parent: 'root' } } as WorkflowStoreState['nodes'],
      selectedId: 'n2',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().selectedId).toBe('n2')
  })

  it('removeNode leaves selectedId undefined when nothing was selected', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().selectedId).toBeUndefined()
  })

  it('removeNode clears selectedId when selected descendant is cascade-removed', async () => {
    const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
    vi.mocked(removeNodePure).mockReturnValueOnce({
      nodes: {},
      edges: {},
      removedNodeIds: ['parent', 'child-1', 'child-2'],
    })

    const store = makeStore({
      nodes: {
        parent: { id: 'parent' },
        'child-1': { id: 'child-1' },
        'child-2': { id: 'child-2' },
      } as WorkflowStoreState['nodes'],
      selectedId: 'child-2',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('parent')

    expect(store.getState().selectedId).toBeUndefined()
  })

  it('removeNode evicts cascade-removed ids from selectedIds', async () => {
    const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
    vi.mocked(removeNodePure).mockReturnValueOnce({
      nodes: { root: { id: 'root' } },
      edges: {},
      removedNodeIds: ['n1', 'child-of-n1'],
    })

    const store = makeStore({
      nodes: {
        root: { id: 'root' },
        n1: { id: 'n1' },
        'child-of-n1': { id: 'child-of-n1' },
      } as WorkflowStoreState['nodes'],
      selectedIds: new Set(['root', 'n1', 'child-of-n1']),
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().selectedIds).toEqual(new Set(['root']))
  })

  it('removeNode clears anchorId when anchor is among removed nodes', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
      anchorId: 'n1',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().anchorId).toBeUndefined()
  })

  it('removeNode clears anchorId when anchor is cascade-removed', async () => {
    const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
    vi.mocked(removeNodePure).mockReturnValueOnce({
      nodes: {},
      edges: {},
      removedNodeIds: ['parent', 'child'],
    })

    const store = makeStore({
      nodes: {
        parent: { id: 'parent' },
        child: { id: 'child' },
      } as WorkflowStoreState['nodes'],
      anchorId: 'child',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('parent')

    expect(store.getState().anchorId).toBeUndefined()
  })

  it('removeNode preserves anchorId when anchor is not among removed nodes', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' }, n2: { id: 'n2', parent: 'root' } } as WorkflowStoreState['nodes'],
      anchorId: 'n2',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().anchorId).toBe('n2')
  })

  it('removeNode leaves anchorId undefined when no anchor was set', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().anchorId).toBeUndefined()
  })

  it('removeNode syncs selectedIds to nextSelectedId when deleting the selected node', () => {
    const store = makeStore({
      nodes: {
        root: { id: 'root', children: ['n1', 'n2'] },
        n1: { id: 'n1', parent: 'root', children: [] },
        n2: { id: 'n2', parent: 'root', children: [] },
      } as WorkflowStoreState['nodes'],
      selectedId: 'n1',
      selectedIds: new Set(['n1']),
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().selectedId).toBe('n2')
    expect(store.getState().selectedIds).toEqual(new Set(['n2']))
  })

  it('removeNode sets anchorId to nextSelectedId when anchor is the deleted node', () => {
    const store = makeStore({
      nodes: {
        root: { id: 'root', children: ['n1', 'n2'] },
        n1: { id: 'n1', parent: 'root', children: [] },
        n2: { id: 'n2', parent: 'root', children: [] },
      } as WorkflowStoreState['nodes'],
      selectedId: 'n1',
      anchorId: 'n1',
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    removeNode('n1')

    expect(store.getState().anchorId).toBe('n2')
  })

  describe('removeNodes', () => {
    it('removes multiple top-level nodes in a single operation', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure)
        .mockReturnValueOnce({
          nodes: { root: { id: 'root', children: ['b'] }, b: { id: 'b', parent: 'root' } },
          edges: {},
          removedNodeIds: ['a'],
        })
        .mockReturnValueOnce({ nodes: { root: { id: 'root', children: [] } }, edges: {}, removedNodeIds: ['b'] })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const count = removeNodes(new Set(['a', 'b']))

      expect(count).toBe(2)
      expect(store.getState().selectedId).toBeUndefined()
      expect(store.getState().selectedIds.size).toBe(0)
      expect(store.getState().isDirty).toBe(true)
      expect(persister.schedule).toHaveBeenCalledOnce()
    })

    it('skips root nodes', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const count = removeNodes(new Set(['root']))

      expect(count).toBe(0)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('deletes child when root and child are both targeted', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: [] } },
        edges: {},
        removedNodeIds: ['child'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['child'] },
          child: { id: 'child', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const count = removeNodes(new Set(['root', 'child']))

      expect(count).toBe(1)
      expect(store.getState().isDirty).toBe(true)
    })

    it('skips executing nodes', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['n1'] },
          n1: { id: 'n1', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        executingNodeIds: new Set(['n1']),
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const count = removeNodes(new Set(['n1']))

      expect(count).toBe(0)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('returns 0 for empty set', () => {
      const store = makeStore()
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      expect(removeNodes(new Set())).toBe(0)
    })

    it('removes only deletable nodes from mixed input', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: [] } },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        executingNodeIds: new Set(['b']),
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const count = removeNodes(new Set(['a', 'b', 'ghost']))

      expect(count).toBe(1)
      expect(persister.schedule).toHaveBeenCalledOnce()
    })

    it('handles node already removed by earlier cascade', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure)
        .mockReturnValueOnce({
          nodes: { root: { id: 'root', children: [] } },
          edges: {},
          removedNodeIds: ['a', 'b'],
        })
        .mockImplementationOnce(() => {
          throw new Error('Node not found')
        })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: ['b'] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const count = removeNodes(new Set(['a', 'b']))

      expect(count).toBe(1)
      expect(store.getState().isDirty).toBe(true)
    })

    it('preserves selection on surviving nodes after partial delete', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: {
          root: { id: 'root', children: ['b'] },
          b: { id: 'b', parent: 'root', checked: true },
        },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [], checked: true },
        } as WorkflowStoreState['nodes'],
        selectedIds: new Set(['a', 'b']),
        selectedId: 'b',
        executingNodeIds: new Set(['b']),
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a', 'b']))

      expect(store.getState().selectedIds).toEqual(new Set(['b']))
      expect(store.getState().selectedId).toBe('b')
      expect(store.getState().nodes.b.checked).toBe(true)
    })

    it('updates selectedId to last remaining selection after partial delete', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: {
          root: { id: 'root', children: ['b', 'c'] },
          b: { id: 'b', parent: 'root' },
          c: { id: 'c', parent: 'root' },
        },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b', 'c'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
          c: { id: 'c', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        selectedIds: new Set(['a', 'b', 'c']),
        selectedId: 'c',
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a']))

      expect(store.getState().selectedIds).toEqual(new Set(['b', 'c']))
      expect(store.getState().selectedId).toBe('c')
    })

    it('clears anchorId when anchor is among removed nodes', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: ['b'] }, b: { id: 'b', parent: 'root' } },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        anchorId: 'a',
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a']))

      expect(store.getState().anchorId).toBeUndefined()
    })

    it('preserves anchorId when anchor survives deletion', async () => {
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: ['b'] }, b: { id: 'b', parent: 'root' } },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        anchorId: 'b',
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a']))

      expect(store.getState().anchorId).toBe('b')
    })

    it('toasts when some nodes were skipped', async () => {
      const { toast } = await import('sonner')
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: ['b'] }, b: { id: 'b', parent: 'root' } },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        executingNodeIds: new Set(['b']),
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a', 'b']))

      expect(toast.warning).toHaveBeenCalledOnce()
    })

    it('does not toast when all targeted nodes were removed', async () => {
      const { toast } = await import('sonner')
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: [] } },
        edges: {},
        removedNodeIds: ['a'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a'] },
          a: { id: 'a', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a']))

      expect(toast.warning).not.toHaveBeenCalled()
    })

    it('does not toast when descendant in selection was cascade-removed', async () => {
      const { toast } = await import('sonner')
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: { root: { id: 'root', children: [] } },
        edges: {},
        removedNodeIds: ['a', 'a1'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a'] },
          a: { id: 'a', parent: 'root', children: ['a1'] },
          a1: { id: 'a1', parent: 'a', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a', 'a1']))

      expect(toast.warning).not.toHaveBeenCalled()
    })

    it('counts cascade-removed descendants as removed in toast', async () => {
      const { toast } = await import('sonner')
      const { removeNode: removeNodePure } = await import('@entities/workflow/lib')
      vi.mocked(removeNodePure).mockReturnValueOnce({
        nodes: {
          root: { id: 'root', children: ['b'] },
          b: { id: 'b', parent: 'root' },
        },
        edges: {},
        removedNodeIds: ['a', 'a1'],
      })

      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', children: ['a1'] },
          a1: { id: 'a1', parent: 'a', children: [] },
          b: { id: 'b', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
        executingNodeIds: new Set(['b']),
      })
      const persister = makePersister()
      const { removeNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      removeNodes(new Set(['a', 'a1', 'b']))

      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('bulkDeletePartial'))
    })
  })

  describe('importTextAsPrompts', () => {
    it('imports non-empty paragraphs as prompt children while preserving regular children', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', title: 'Root', children: ['regular'] },
          regular: { id: 'regular', title: 'Regular child', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { importTextAsPrompts } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const imported = importTextAsPrompts('root', 'First paragraph\n\n\nSecond paragraph')
      const nodes = store.getState().nodes
      const root = nodes.root
      const promptTitles = (root.prompts ?? []).map(id => nodes[id]?.title)

      expect(imported).toBe(2)
      expect(root.children).toContain('regular')
      expect(promptTitles).toEqual(['First paragraph', 'Second paragraph'])
      expect(store.getState().isDirty).toBe(true)
      expect(persister.schedule).toHaveBeenCalled()
    })

    it('replaces previous prompt children without removing regular children', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['regular', 'old-prompt'], prompts: ['old-prompt'] },
          regular: { id: 'regular', title: 'Regular child', parent: 'root', children: [] },
          'old-prompt': { id: 'old-prompt', title: 'Old prompt', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { importTextAsPrompts } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const imported = importTextAsPrompts('root', 'Replacement prompt')
      const nodes = store.getState().nodes
      const root = nodes.root

      expect(imported).toBe(1)
      expect(nodes['old-prompt']).toBeUndefined()
      expect(root.children).toContain('regular')
      expect(root.children).not.toContain('old-prompt')
      expect((root.prompts ?? []).map(id => nodes[id]?.title)).toEqual(['Replacement prompt'])
    })

    it('replaces prompt children on same-session re-import', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { importTextAsPrompts } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      expect(importTextAsPrompts('root', 'First\n\nSecond\n\nThird')).toBe(3)
      expect(importTextAsPrompts('root', 'First\n\nSecond\n\nThird')).toBe(3)

      const nodes = store.getState().nodes
      const root = nodes.root

      expect(root.children).toHaveLength(3)
      expect(root.prompts).toHaveLength(3)
      expect(Object.keys(nodes)).toHaveLength(4)
      expect((root.prompts ?? []).map(id => nodes[id]?.title)).toEqual(['First', 'Second', 'Third'])
    })

    it('removes stale prompt nodes when re-importing a different paragraph set', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['regular'] },
          regular: { id: 'regular', title: 'Regular child', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const persister = makePersister()
      const { importTextAsPrompts } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      expect(importTextAsPrompts('root', 'First\n\nSecond\n\nThird')).toBe(3)
      expect(importTextAsPrompts('root', 'Only replacement')).toBe(1)

      const nodes = store.getState().nodes
      const root = nodes.root

      expect(root.children).toHaveLength(2)
      expect(root.children).toContain('regular')
      expect(root.prompts).toHaveLength(1)
      expect(Object.keys(nodes)).toHaveLength(3)
      expect((root.prompts ?? []).map(id => nodes[id]?.title)).toEqual(['Only replacement'])
    })

    it('does not mutate or persist blank text', () => {
      const initialNodes = {
        root: { id: 'root', children: [] },
      } as WorkflowStoreState['nodes']
      const store = makeStore({ nodes: initialNodes })
      const persister = makePersister()
      const { importTextAsPrompts } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

      const imported = importTextAsPrompts('root', '  \n\n  ')

      expect(imported).toBe(0)
      expect(store.getState().nodes).toBe(initialNodes)
      expect(store.getState().isDirty).toBe(false)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('single-paragraph text imports as exactly one prompt child', () => {
      const store = makeStore({
        nodes: { root: { id: 'root', children: [] } } as WorkflowStoreState['nodes'],
      })
      const { importTextAsPrompts } = bindMutationActions(store, makePersister(), mockFormatMessage, makeHistory())

      const imported = importTextAsPrompts('root', 'Only one paragraph')
      const nodes = store.getState().nodes

      expect(imported).toBe(1)
      expect(nodes.root.prompts).toHaveLength(1)
      expect(nodes[nodes.root.prompts![0]]?.title).toBe('Only one paragraph')
    })

    it('preserves all regular children across multiple sequential re-imports', () => {
      const store = makeStore({
        nodes: {
          root: { id: 'root', children: ['reg1', 'reg2'] },
          reg1: { id: 'reg1', parent: 'root', children: [] },
          reg2: { id: 'reg2', parent: 'root', children: [] },
        } as WorkflowStoreState['nodes'],
      })
      const { importTextAsPrompts } = bindMutationActions(store, makePersister(), mockFormatMessage, makeHistory())

      importTextAsPrompts('root', 'A\n\nB')
      importTextAsPrompts('root', 'C\n\nD\n\nE')
      importTextAsPrompts('root', 'F')

      const nodes = store.getState().nodes
      const root = nodes.root

      expect(root.children).toContain('reg1')
      expect(root.children).toContain('reg2')
      expect(root.prompts).toHaveLength(1)
      expect(nodes[root.prompts![0]]?.title).toBe('F')
    })
  })

  it('duplicateNode returns new root id', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { duplicateNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const newId = duplicateNode('n1')

    expect(newId).toBe('dup-root')
  })

  it('moveNode updates nodes and marks dirty', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { moveNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const ok = moveNode('n1', 'root')

    expect(ok).toBe(true)
    expect(store.getState().isDirty).toBe(true)
    expect(persister.schedule).toHaveBeenCalledOnce()
  })

  it('returns null on mutation error and does not mark dirty', async () => {
    const { createRootNode } = await import('@entities/workflow/lib')
    vi.mocked(createRootNode).mockImplementationOnce(() => {
      throw new MockNodeMutationError('Root exists', 'ROOT_EXISTS')
    })

    const store = makeStore()
    const persister = makePersister()
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const result = createRoot({ title: 'Root' })

    expect(result).toBeNull()
    expect(store.getState().isDirty).toBe(false)
    expect(persister.schedule).not.toHaveBeenCalled()
  })

  it('returns null on unexpected error and does not mark dirty', async () => {
    const { createRootNode } = await import('@entities/workflow/lib')
    vi.mocked(createRootNode).mockImplementationOnce(() => {
      throw new Error('unexpected')
    })

    const store = makeStore()
    const persister = makePersister()
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const result = createRoot({ title: 'Root' })

    expect(result).toBeNull()
    expect(store.getState().isDirty).toBe(false)
  })
})

describe('history integration — checkpoint on every mutation', () => {
  it('checkpoint is called once per successful mutation', () => {
    const store = makeStore()
    const persister = makePersister()
    const history = makeHistory()
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage, history)

    createRoot({ title: 'Root' })

    expect(history.checkpoint).toHaveBeenCalledOnce()
  })

  it('checkpoint receives pre-mutation state (nodes/edges/root)', () => {
    const initialNodes = { p1: { id: 'p1', children: [] } } as WorkflowStoreState['nodes']
    const store = makeStore({ nodes: initialNodes })
    const persister = makePersister()
    const history = makeHistory()
    const { addChild } = bindMutationActions(store, persister, mockFormatMessage, history)

    addChild('p1', { title: 'Child' })

    const captured = history.checkpoint.mock.calls[0]?.[0]
    expect(captured).toMatchObject({ nodes: initialNodes, root: undefined })
  })

  it('checkpoint is NOT called when mutation throws', async () => {
    const { createRootNode } = await import('@entities/workflow/lib')
    vi.mocked(createRootNode).mockImplementationOnce(() => {
      throw new MockNodeMutationError('Root exists', 'ROOT_EXISTS')
    })
    const store = makeStore()
    const persister = makePersister()
    const history = makeHistory()
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage, history)

    createRoot({ title: 'Root' })

    expect(history.checkpoint).not.toHaveBeenCalled()
  })
})

describe('wrapNodes action', () => {
  it('returns the new parent id and selects it', () => {
    const nodes: WorkflowStoreState['nodes'] = {
      root: { id: 'root', title: 'Root', children: ['a', 'b'] },
      a: { id: 'a', title: 'A', parent: 'root', children: [], checked: true },
      b: { id: 'b', title: 'B', parent: 'root', children: [] },
    }
    const store = makeStore({ nodes })
    const persister = makePersister()
    const { wrapNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const newId = wrapNodes(new Set(['a', 'b']))

    expect(newId).toBeTruthy()
    expect(store.getState().selectedId).toBe(newId)
    expect(store.getState().nodes.a.checked).toBe(true)
  })

  it('marks store dirty and schedules persist', () => {
    const nodes: WorkflowStoreState['nodes'] = {
      root: { id: 'root', title: 'Root', children: ['a'] },
      a: { id: 'a', title: 'A', parent: 'root', children: [] },
    }
    const store = makeStore({ nodes })
    const persister = makePersister()
    const { wrapNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    wrapNodes(new Set(['a']))

    expect(store.getState().isDirty).toBe(true)
    expect(persister.schedule).toHaveBeenCalled()
  })

  it('returns null and does not mark dirty when given an empty set', () => {
    const store = makeStore()
    const persister = makePersister()
    const { wrapNodes } = bindMutationActions(store, persister, mockFormatMessage, makeHistory())

    const result = wrapNodes(new Set())

    expect(result).toBeNull()
    expect(store.getState().isDirty).toBe(false)
  })
})

describe('removeNode / removeNodes — attachment flush-failure hardening', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // Nodes shared across tests: n1 has a file attachment, root is its parent.
  const attachedNodes = {
    root: { id: 'root', children: ['n1'] },
    n1: { id: 'n1', parent: 'root', children: [], file: 'file-abc' },
  } as WorkflowStoreState['nodes']

  function makeServerNodes(dangling?: string): WorkflowStoreState['nodes'] {
    if (!dangling) return {}
    return { sv: { id: 'sv', children: [], file: dangling } } as WorkflowStoreState['nodes']
  }

  function makeLifecycle(danglingFileId?: string) {
    return {
      workflowId: 'wf-test',
      deleteWorkflowFile: vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined),
      readWorkflow: vi.fn().mockResolvedValue({
        nodes: makeServerNodes(danglingFileId),
        edges: {},
        root: undefined,
      }),
    }
  }

  function makeExhaustingPersister(): DebouncedPersister {
    return { schedule: vi.fn(), flush: vi.fn().mockResolvedValue(false), cancel: vi.fn(), destroy: vi.fn() }
  }

  describe('removeNode with attachment', () => {
    it('surfaces removeFlushFailed when all flush retries exhausted and server retains the deleted file id', async () => {
      vi.useFakeTimers()
      try {
        const store = makeStore({ nodes: attachedNodes })
        const { removeNode } = bindMutationActions(
          store,
          makeExhaustingPersister(),
          mockFormatMessage,
          makeHistory(),
          makeLifecycle('file-abc'),
        )

        removeNode('n1')
        await vi.runAllTimersAsync()

        const { toast } = await import('sonner')
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('workflowTree.attachment.removeFlushFailed')
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not surface removeFlushFailed when server is clean after flush exhaustion', async () => {
      vi.useFakeTimers()
      try {
        const store = makeStore({ nodes: attachedNodes })
        const { removeNode } = bindMutationActions(
          store,
          makeExhaustingPersister(),
          mockFormatMessage,
          makeHistory(),
          makeLifecycle(), // no dangling file on server
        )

        removeNode('n1')
        await vi.runAllTimersAsync()

        const { toast } = await import('sonner')
        expect(vi.mocked(toast.error)).not.toHaveBeenCalledWith('workflowTree.attachment.removeFlushFailed')
      } finally {
        vi.useRealTimers()
      }
    })

    it('confirms server readback before deleting bytes when flush succeeds', async () => {
      vi.useFakeTimers()
      try {
        const store = makeStore({ nodes: attachedNodes })
        const readWorkflow = vi.fn().mockResolvedValue({ nodes: {}, edges: {}, root: undefined })
        const persister: DebouncedPersister = {
          schedule: vi.fn(),
          flush: vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),
          cancel: vi.fn(),
          destroy: vi.fn(),
        }
        const { removeNode } = bindMutationActions(store, persister, mockFormatMessage, makeHistory(), {
          workflowId: 'wf-test',
          deleteWorkflowFile: vi.fn<[string, string], Promise<void>>().mockResolvedValue(undefined),
          readWorkflow,
        })

        removeNode('n1')
        await vi.runAllTimersAsync()

        expect(readWorkflow).toHaveBeenCalledWith('wf-test')
        const { toast } = await import('sonner')
        expect(vi.mocked(toast.error)).not.toHaveBeenCalledWith('workflowTree.attachment.removeFlushFailed')
      } finally {
        vi.useRealTimers()
      }
    })

    it('removes the node from local state even when all flushes fail permanently', async () => {
      vi.useFakeTimers()
      try {
        const store = makeStore({ nodes: attachedNodes })
        const { removeNode } = bindMutationActions(
          store,
          makeExhaustingPersister(),
          mockFormatMessage,
          makeHistory(),
          makeLifecycle(),
        )

        removeNode('n1')
        await vi.runAllTimersAsync()

        expect(store.getState().nodes).not.toHaveProperty('n1')
        expect(store.getState().isDirty).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('removeNodes with attachment', () => {
    it('surfaces removeFlushFailed when bulk flush exhausted and server retains a removed file id', async () => {
      vi.useFakeTimers()
      try {
        const store = makeStore({ nodes: attachedNodes })
        const { removeNodes } = bindMutationActions(
          store,
          makeExhaustingPersister(),
          mockFormatMessage,
          makeHistory(),
          makeLifecycle('file-abc'),
        )

        removeNodes(new Set(['n1']))
        await vi.runAllTimersAsync()

        const { toast } = await import('sonner')
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('workflowTree.attachment.removeFlushFailed')
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not surface removeFlushFailed when bulk flush exhausted but server is clean', async () => {
      vi.useFakeTimers()
      try {
        const store = makeStore({ nodes: attachedNodes })
        const { removeNodes } = bindMutationActions(
          store,
          makeExhaustingPersister(),
          mockFormatMessage,
          makeHistory(),
          makeLifecycle(),
        )

        removeNodes(new Set(['n1']))
        await vi.runAllTimersAsync()

        const { toast } = await import('sonner')
        expect(vi.mocked(toast.error)).not.toHaveBeenCalledWith('workflowTree.attachment.removeFlushFailed')
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
