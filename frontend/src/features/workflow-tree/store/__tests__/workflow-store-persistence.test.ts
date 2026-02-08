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

  it('returns false and preserves dirty on save failure', async () => {
    const store = makeStore({ isDirty: true })
    const saveFn = vi.fn().mockRejectedValue(new Error('network'))
    const persister = createDebouncedPersister(store, saveFn)

    const result = await persister.flush()

    expect(result).toBe(false)
    expect(store.getState().isDirty).toBe(true)
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
})
