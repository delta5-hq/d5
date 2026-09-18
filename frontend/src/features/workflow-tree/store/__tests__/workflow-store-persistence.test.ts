import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { createDebouncedPersister } from '../workflow-store-persistence'
import { createStore } from '@shared/lib/store'

function makeStore(overrides: Partial<WorkflowStoreState> = {}) {
  return createStore<WorkflowStoreState>({
    ...INITIAL_WORKFLOW_STATE,
    workflowId: 'wf-test',
    ...overrides,
  })
}

describe('createDebouncedPersister', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('does not save when state is not dirty', async () => {
    const store = makeStore({ isDirty: false })
    const saveFn = vi.fn().mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    const result = await persister.flush()

    expect(result).toBe(true)
    expect(saveFn).not.toHaveBeenCalled()
  })

  it('saves dirty state and marks clean on success', async () => {
    const store = makeStore({ isDirty: true, nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'] })
    const saveFn = vi.fn().mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    const result = await persister.flush()

    expect(result).toBe(true)
    expect(saveFn).toHaveBeenCalledOnce()
    expect(store.getState().isDirty).toBe(false)
    expect(store.getState().isSaving).toBe(false)
  })

  it('flush clears dirtyNodeIds on success', async () => {
    const store = makeStore({
      isDirty: true,
      dirtyNodeIds: new Set(['n1', 'n2']),
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
    })
    const saveFn = vi.fn().mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    await persister.flush()

    expect(store.getState().dirtyNodeIds).toEqual(new Set())
  })

  it('returns false and preserves isDirty and dirtyNodeIds on save failure', async () => {
    const store = makeStore({ isDirty: true, dirtyNodeIds: new Set(['n1']) })
    const saveFn = vi.fn().mockRejectedValue(new Error('network'))
    const persister = createDebouncedPersister(store, saveFn)

    const result = await persister.flush()

    expect(result).toBe(false)
    expect(store.getState().isDirty).toBe(true)
    expect(store.getState().dirtyNodeIds).toEqual(new Set(['n1']))
    expect(store.getState().isSaving).toBe(false)
  })

  it('debounces scheduled saves', async () => {
    const store = makeStore({ isDirty: true })
    const saveFn = vi.fn().mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    persister.schedule()
    persister.schedule()
    persister.schedule()

    expect(saveFn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)

    expect(saveFn).toHaveBeenCalledOnce()
  })

  it('cancels scheduled save', async () => {
    const store = makeStore({ isDirty: true })
    const saveFn = vi.fn().mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    persister.schedule()
    persister.cancel()

    await vi.advanceTimersByTimeAsync(1000)

    expect(saveFn).not.toHaveBeenCalled()
  })

  it('destroy cancels pending scheduled save', async () => {
    const store = makeStore({ isDirty: true })
    const saveFn = vi.fn().mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    persister.schedule()
    persister.destroy()

    await vi.advanceTimersByTimeAsync(1000)

    expect(saveFn).not.toHaveBeenCalled()
  })

  it('flush sends correct payload shape', async () => {
    const nodes = { n1: { id: 'n1' } } as WorkflowStoreState['nodes']
    const edges = { e1: { id: 'e1', start: 'a', end: 'b' } } as WorkflowStoreState['edges']
    const store = makeStore({ isDirty: true, nodes, edges, root: 'n1' })
    const saveFn = vi.fn().mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    await persister.flush()

    expect(saveFn).toHaveBeenCalledWith({ nodes, edges, root: 'n1' })
  })

  it('sets isSaving during save', async () => {
    const store = makeStore({ isDirty: true })
    let savingDuringCall = false
    const saveFn = vi.fn().mockImplementation(() => {
      savingDuringCall = store.getState().isSaving
      return Promise.resolve({})
    })
    const persister = createDebouncedPersister(store, saveFn)

    await persister.flush()

    expect(savingDuringCall).toBe(true)
    expect(store.getState().isSaving).toBe(false)
  })

  it('serializes an intervening edit behind an in-flight save and persists the newest state last', async () => {
    let releaseFirstSave!: () => void
    const firstSave = new Promise<void>(resolve => {
      releaseFirstSave = resolve
    })
    const initialNodes = { root: { id: 'root', title: 'Before', children: [] } } as WorkflowStoreState['nodes']
    const updatedNodes = { root: { id: 'root', title: 'After', children: [] } } as WorkflowStoreState['nodes']
    const store = makeStore({ isDirty: true, nodes: initialNodes, root: 'root' })
    const saveFn = vi
      .fn()
      .mockImplementationOnce(() => firstSave)
      .mockResolvedValue({})
    const persister = createDebouncedPersister(store, saveFn)

    const firstFlush = persister.flush()
    await Promise.resolve()
    store.setState({ nodes: updatedNodes, isDirty: true })
    const concurrentFlush = persister.flush()
    releaseFirstSave()

    await Promise.all([firstFlush, concurrentFlush])

    expect(saveFn).toHaveBeenCalledTimes(2)
    expect(saveFn).toHaveBeenNthCalledWith(1, { nodes: initialNodes, edges: {}, root: 'root' })
    expect(saveFn).toHaveBeenNthCalledWith(2, { nodes: updatedNodes, edges: {}, root: 'root' })
    expect(store.getState().nodes.root.title).toBe('After')
    expect(store.getState().isDirty).toBe(false)
  })
})
