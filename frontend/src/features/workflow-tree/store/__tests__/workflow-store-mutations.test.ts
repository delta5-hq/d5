import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from '@shared/lib/store'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { bindMutationActions, type FormatMessage } from '../workflow-store-mutations'
import type { DebouncedPersister } from '../workflow-store-persistence'

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

vi.mock('@entities/workflow/lib', () => ({
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
}))

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

const mockFormatMessage: FormatMessage = (d: { id: string }) => d.id

describe('bindMutationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createRoot adds node and marks dirty', () => {
    const store = makeStore()
    const persister = makePersister()
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage)

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
    const { addChild } = bindMutationActions(store, persister, mockFormatMessage)

    const newId = addChild('p1', { title: 'Child' })

    expect(newId).toBe('new-child')
    expect(store.getState().isDirty).toBe(true)
  })

  it('updateNode modifies node fields', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', title: 'old' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { updateNode } = bindMutationActions(store, persister, mockFormatMessage)

    const ok = updateNode('n1', { title: 'new' })

    expect(ok).toBe(true)
    expect(store.getState().isDirty).toBe(true)
  })

  it('removeNode removes node', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { removeNode } = bindMutationActions(store, persister, mockFormatMessage)

    const ok = removeNode('n1')

    expect(ok).toBe(true)
  })

  it('duplicateNode returns new root id', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { duplicateNode } = bindMutationActions(store, persister, mockFormatMessage)

    const newId = duplicateNode('n1')

    expect(newId).toBe('dup-root')
  })

  it('moveNode updates nodes and marks dirty', () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1', parent: 'root' } } as WorkflowStoreState['nodes'],
    })
    const persister = makePersister()
    const { moveNode } = bindMutationActions(store, persister, mockFormatMessage)

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
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage)

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
    const { createRoot } = bindMutationActions(store, persister, mockFormatMessage)

    const result = createRoot({ title: 'Root' })

    expect(result).toBeNull()
    expect(store.getState().isDirty).toBe(false)
  })
})
