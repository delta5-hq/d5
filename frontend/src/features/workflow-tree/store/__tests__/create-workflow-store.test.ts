import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkflowStore } from '../create-workflow-store'
import type { FormatMessage } from '../workflow-store-mutations'

const mockApiResponse = {
  _id: 'wf-1',
  workflowId: 'wf-test',
  userId: 'u1',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-02',
  nodes: { root: { id: 'root', title: 'Root', children: ['c1'] }, c1: { id: 'c1', title: 'Child', parent: 'root' } },
  edges: {},
  root: 'root',
  share: { access: [] },
}

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../../../api/execute-workflow-command', () => ({
  executeWorkflowCommand: vi.fn(),
}))

import { apiFetch } from '@shared/lib/base-api'

const mockFormatMessage: FormatMessage = (d: { id: string }) => d.id

describe('createWorkflowStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('initializes with loading false and empty state', () => {
    const { store } = createWorkflowStore('wf-test', mockFormatMessage)
    const state = store.getState()

    expect(state.workflowId).toBe('wf-test')
    expect(state.nodes).toEqual({})
    expect(state.isLoading).toBe(false)
    expect(state.selectedId).toBeUndefined()
  })

  it('load fetches workflow and populates state', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    await actions.load()

    expect(apiFetch).toHaveBeenCalledWith('/workflow/wf-test')
    expect(store.getState().nodes).toEqual(mockApiResponse.nodes)
    expect(store.getState().root).toBe('root')
    expect(store.getState().isLoading).toBe(false)
    expect(store.getState().error).toBeNull()
  })

  it('load sets error on failure', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'))
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    await actions.load()

    expect(store.getState().isLoading).toBe(false)
    expect(store.getState().error).toBeInstanceOf(Error)
    expect(store.getState().error?.message).toBe('Network error')
  })

  it('persist sends PUT with current state', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse).mockResolvedValueOnce({})
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    await actions.load()
    store.setState({ isDirty: true })

    const saved = await actions.persistNow()

    expect(saved).toBe(true)
    expect(store.getState().isDirty).toBe(false)
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/workflow/wf-test', expect.objectContaining({ method: 'PUT' }))
  })

  it('destroy cleans up persister and store', () => {
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    const listener = vi.fn()
    store.subscribe(listener)

    actions.destroy()
    store.setState({ isDirty: true })

    expect(listener).not.toHaveBeenCalled()
  })

  it('discard reloads data from server', async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    await actions.load()
    store.setState({ isDirty: true, nodes: {} })

    actions.discard()
    await vi.waitFor(() => expect(store.getState().isDirty).toBe(false))

    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2)
  })

  it('load can be called multiple times', async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    await actions.load()
    await actions.load()

    expect(store.getState().nodes).toEqual(mockApiResponse.nodes)
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2)
  })

  it('select updates selectedId to given node', () => {
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    actions.select('root')

    expect(store.getState().selectedId).toBe('root')
  })

  it('select clears selectedId when given undefined', () => {
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    actions.select('root')

    actions.select(undefined)

    expect(store.getState().selectedId).toBeUndefined()
  })

  it('select replaces previously selected node', () => {
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    actions.select('node-a')

    actions.select('node-b')

    expect(store.getState().selectedId).toBe('node-b')
  })

  it('load clears selectedId when referenced node is absent from server data', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    store.setState({ selectedId: 'deleted-node' })

    await actions.load()

    expect(store.getState().selectedId).toBeUndefined()
  })

  it('load preserves selectedId when referenced node exists in server data', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    store.setState({ selectedId: 'root' })

    await actions.load()

    expect(store.getState().selectedId).toBe('root')
  })

  it('load leaves selectedId undefined when no prior selection exists', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    await actions.load()

    expect(store.getState().selectedId).toBeUndefined()
  })

  it('load error does not modify selectedId', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'))
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    store.setState({ selectedId: 'some-node' })

    await actions.load()

    expect(store.getState().selectedId).toBe('some-node')
  })

  describe('selectedIds', () => {
    it('select syncs selectedIds to a singleton set', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

      actions.select('a')

      expect(store.getState().selectedIds).toEqual(new Set(['a']))
    })

    it('select with undefined clears selectedIds', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')

      actions.select(undefined)

      expect(store.getState().selectedIds.size).toBe(0)
    })

    it('toggleSelect adds node to selectedIds', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')

      actions.toggleSelect('b')

      expect(store.getState().selectedIds).toEqual(new Set(['a', 'b']))
    })

    it('toggleSelect on empty selection adds first node', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

      actions.toggleSelect('x')

      expect(store.getState().selectedIds).toEqual(new Set(['x']))
      expect(store.getState().selectedId).toBe('x')
    })

    it('toggleSelect removes already-selected node', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')
      actions.toggleSelect('b')

      actions.toggleSelect('a')

      expect(store.getState().selectedIds).toEqual(new Set(['b']))
    })

    it('toggleSelect updates selectedId to last-in-set', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')

      actions.toggleSelect('b')

      expect(store.getState().selectedId).toBe('b')
    })

    it('toggleSelect clears selectedId when set becomes empty', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')

      actions.toggleSelect('a')

      expect(store.getState().selectedId).toBeUndefined()
      expect(store.getState().selectedIds.size).toBe(0)
    })

    it('select after multi-selection resets to singleton', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')
      actions.toggleSelect('b')
      actions.toggleSelect('c')
      expect(store.getState().selectedIds.size).toBe(3)

      actions.select('b')

      expect(store.getState().selectedIds).toEqual(new Set(['b']))
      expect(store.getState().selectedId).toBe('b')
    })

    it('load evicts stale ids from selectedIds', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ selectedIds: new Set(['root', 'gone']) })

      await actions.load()

      expect(store.getState().selectedIds).toEqual(new Set(['root']))
    })

    it('load preserves selectedIds when all nodes exist', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ selectedIds: new Set(['root', 'c1']) })

      await actions.load()

      expect(store.getState().selectedIds).toEqual(new Set(['root', 'c1']))
    })

    it('load error does not modify selectedIds', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'))
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ selectedIds: new Set(['a', 'b']) })

      await actions.load()

      expect(store.getState().selectedIds).toEqual(new Set(['a', 'b']))
    })
  })
})
