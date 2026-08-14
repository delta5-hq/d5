import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkflowStore } from '../create-workflow-store'
import type { NodeDatas } from '@shared/base-types'
import type { FormatMessage } from '../workflow-store-mutations'
import type { WorkflowStoreActions } from '../workflow-store-types'

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

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }))

import { apiFetch } from '@shared/lib/base-api'
import { toast } from 'sonner'

const mockFormatMessage: FormatMessage = (d: { id: string }) => d.id
const uploadedFile = { id: 'file-1', filename: 'notes.txt', length: 5 }

const workflowWithFileNode = {
  ...mockApiResponse,
  nodes: {
    root: { id: 'root', title: 'Root', children: ['file-node', 'c1'] },
    'file-node': { id: 'file-node', title: 'notes.txt', parent: 'root', file: uploadedFile.id },
    c1: { id: 'c1', title: 'Child', parent: 'root' },
  },
}

const workflowWithFileNodes = {
  ...mockApiResponse,
  nodes: {
    root: { id: 'root', title: 'Root', children: ['a', 'b', 'c'] },
    a: { id: 'a', title: 'A', parent: 'root', file: 'file-a' },
    b: { id: 'b', title: 'B', parent: 'root', file: 'file-a' },
    c: { id: 'c', title: 'C', parent: 'root', file: 'file-c' },
  },
}
const workflowFile = () => new File(['hello'], uploadedFile.filename)
const flushAsyncWork = () => new Promise(resolve => setTimeout(resolve, 0))

/** Drains all pending microtasks for operations that chain multiple async steps. */
const drainQueue = async () => {
  await flushAsyncWork()
  await flushAsyncWork()
  await flushAsyncWork()
}

/** Loads a store pre-seeded with a single file-attachment node, DELETE and PUT mocked to succeed. */
async function loadWorkflowWithFileNode() {
  let persisted = workflowWithFileNode
  vi.mocked(apiFetch).mockImplementation(async (url: string, o?: { method?: string; body?: string }) => {
    if (url === '/workflow/wf-test' && o?.method === 'PUT') {
      persisted = { ...persisted, ...JSON.parse(String(o.body)) }
      return {}
    }
    if (url.startsWith('/workflow/wf-test/files/') && o?.method === 'DELETE') return {}
    return persisted
  })
  const bundle = createWorkflowStore('wf-test', mockFormatMessage)
  await bundle.actions.load()
  return bundle
}

/** Loads a store pre-seeded with three nodes sharing two file references, DELETE and PUT mocked to succeed. */
async function loadWorkflowWithFileNodes() {
  let persisted = workflowWithFileNodes
  vi.mocked(apiFetch).mockImplementation(async (url: string, o?: { method?: string; body?: string }) => {
    if (url === '/workflow/wf-test' && o?.method === 'PUT') {
      persisted = { ...persisted, ...JSON.parse(String(o.body)) }
      return {}
    }
    if (url.startsWith('/workflow/wf-test/files/') && o?.method === 'DELETE') return {}
    return persisted
  })
  const bundle = createWorkflowStore('wf-test', mockFormatMessage)
  await bundle.actions.load()
  return bundle
}

function mockLoadedWorkflowWithUploadedFile(...outcomes: Array<unknown>): void {
  vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse).mockResolvedValueOnce(uploadedFile)
  for (const outcome of outcomes) {
    if (outcome instanceof Error) vi.mocked(apiFetch).mockRejectedValueOnce(outcome)
    else vi.mocked(apiFetch).mockResolvedValueOnce(outcome)
  }
}

async function attachFileToRoot() {
  const storeBundle = createWorkflowStore('wf-test', mockFormatMessage)
  await storeBundle.actions.load()
  const nodeId = await storeBundle.actions.attachFileChild('root', workflowFile())
  return { ...storeBundle, nodeId }
}

function findAttachmentNode(nodes: NodeDatas) {
  return Object.values(nodes).find(node => node.file === uploadedFile.id)
}

function mockAttachWithAuthoritativeReadback(readbackOverride?: (persistedBody: unknown) => unknown): void {
  vi.mocked(apiFetch).mockImplementation(async (url, options) => {
    if (url === '/workflow/wf-test/files') return uploadedFile
    if (url === '/workflow/wf-test' && options?.method === 'PUT') return {}
    if (url === '/workflow/wf-test') {
      const putCall = vi
        .mocked(apiFetch)
        .mock.calls.find(([callUrl, callOptions]) => callUrl === '/workflow/wf-test' && callOptions?.method === 'PUT')
      if (!putCall) return mockApiResponse
      const persistedBody = JSON.parse(String(putCall[1]?.body))
      return readbackOverride?.(persistedBody) ?? { ...mockApiResponse, ...persistedBody }
    }
    return {}
  })
}

describe('createWorkflowStore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('initializes as loading so empty-state actions stay unavailable before the initial fetch', () => {
    const { store } = createWorkflowStore('wf-test', mockFormatMessage)
    const state = store.getState()

    expect(state.workflowId).toBe('wf-test')
    expect(state.nodes).toEqual({})
    expect(state.isLoading).toBe(true)
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

  it('load clears dirtyNodeIds on success', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    store.setState({ dirtyNodeIds: new Set(['root', 'c1']) })

    await actions.load()

    expect(store.getState().dirtyNodeIds).toEqual(new Set())
  })

  it('load error does not modify dirtyNodeIds', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'))
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
    store.setState({ dirtyNodeIds: new Set(['root']) })

    await actions.load()

    expect(store.getState().dirtyNodeIds).toEqual(new Set(['root']))
  })

  it('load can be called multiple times', async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockApiResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    await actions.load()
    await actions.load()

    expect(store.getState().nodes).toEqual(mockApiResponse.nodes)
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2)
  })

  it('only applies the latest overlapping load response', async () => {
    let resolveFirstLoad!: (value: unknown) => void
    const firstLoadResponse = new Promise<unknown>(resolve => {
      resolveFirstLoad = resolve
    })
    const latestResponse = {
      ...mockApiResponse,
      nodes: { latest: { id: 'latest', title: 'Latest' } },
      root: 'latest',
    }
    vi.mocked(apiFetch).mockReturnValueOnce(firstLoadResponse).mockResolvedValueOnce(latestResponse)
    const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

    const staleLoad = actions.load()
    const latestLoad = actions.load()
    await latestLoad
    resolveFirstLoad(mockApiResponse)
    await staleLoad

    expect(store.getState().nodes).toEqual(latestResponse.nodes)
    expect(store.getState().root).toBe('latest')
    expect(store.getState().isLoading).toBe(false)
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

    it('keeps ordinary, modifier, and range selection runtime-only', async () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      const nodes = {
        root: { id: 'root', title: 'Root', children: ['a', 'b', 'c'] },
        a: { id: 'a', title: 'A', parent: 'root', children: [], checked: true },
        b: { id: 'b', title: 'B', parent: 'root', children: [] },
        c: { id: 'c', title: 'C', parent: 'root', children: [] },
      }
      store.setState({ nodes })

      actions.select('b')
      actions.toggleSelect('c')
      actions.rangeSelect('c', ['a', 'b', 'c'])
      actions.select(undefined)

      expect(store.getState().nodes).toBe(nodes)
      expect(store.getState().nodes.a.checked).toBe(true)
      expect(store.getState().nodes.b.checked).toBeUndefined()
      expect(store.getState().nodes.c.checked).toBeUndefined()
      expect(store.getState().isDirty).toBe(false)
      expect(store.getState().dirtyNodeIds).toEqual(new Set())
      expect(await actions.persistNow()).toBe(true)
      expect(vi.mocked(apiFetch)).not.toHaveBeenCalled()
    })

    it('persists explicit checkbox changes independently of ordinary selection', async () => {
      vi.mocked(apiFetch).mockResolvedValue({})
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({
        nodes: {
          root: { id: 'root', title: 'Root', children: ['a', 'b'] },
          a: { id: 'a', title: 'A', parent: 'root', children: [], checked: true },
          b: { id: 'b', title: 'B', parent: 'root', children: [] },
        },
      })

      actions.select('b')
      actions.toggleChecked('b')

      expect(store.getState().nodes.a.checked).toBe(true)
      expect(store.getState().nodes.b.checked).toBe(true)
      expect(store.getState().selectedIds).toEqual(new Set(['a', 'b']))
      expect(store.getState().selectedId).toBe('b')
      expect(store.getState().isDirty).toBe(true)
      expect(store.getState().dirtyNodeIds).toEqual(new Set(['b']))

      expect(await actions.persistNow()).toBe(true)
      expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/workflow/wf-test', expect.objectContaining({ method: 'PUT' }))

      actions.select('a')
      expect(store.getState().nodes.b.checked).toBe(true)
      expect(store.getState().isDirty).toBe(false)
      expect(await actions.persistNow()).toBe(true)
      expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1)
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

    it('load rehydrates selectedIds from persisted checked nodes', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ...mockApiResponse,
        nodes: {
          root: { id: 'root', title: 'Root', children: ['a', 'b'] },
          a: { id: 'a', parent: 'root', title: 'A', children: [], checked: true },
          b: { id: 'b', parent: 'root', title: 'B', children: [] },
        },
      })
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ selectedIds: new Set(['b']) })

      await actions.load()

      expect(store.getState().selectedIds).toEqual(new Set(['a']))
      expect(store.getState().selectedId).toBe('a')
    })

    it('load rehydrates all persisted checked nodes in API order', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ...mockApiResponse,
        nodes: {
          root: { id: 'root', title: 'Root', children: ['a', 'b', 'c'] },
          a: { id: 'a', parent: 'root', title: 'A', children: [], checked: true },
          b: { id: 'b', parent: 'root', title: 'B', children: [], checked: false },
          c: { id: 'c', parent: 'root', title: 'C', children: [], checked: true },
        },
      })
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

      await actions.load()

      expect([...store.getState().selectedIds]).toEqual(['a', 'c'])
      expect(store.getState().selectedId).toBe('c')
    })

    it('load clears selectedIds when persisted checked state says every node is unchecked', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ...mockApiResponse,
        nodes: {
          root: { id: 'root', title: 'Root', children: ['a', 'b'], checked: false },
          a: { id: 'a', parent: 'root', title: 'A', children: [], checked: false },
          b: { id: 'b', parent: 'root', title: 'B', children: [], checked: false },
        },
      })
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ selectedId: 'a', selectedIds: new Set(['a', 'b']) })

      await actions.load()

      expect(store.getState().selectedIds).toEqual(new Set())
      expect(store.getState().selectedId).toBeUndefined()
    })

    it('load error does not modify selectedIds', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'))
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ selectedIds: new Set(['a', 'b']) })

      await actions.load()

      expect(store.getState().selectedIds).toEqual(new Set(['a', 'b']))
    })
  })

  describe('anchorId and rangeSelect', () => {
    it('select sets anchorId to selected node', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

      actions.select('a')

      expect(store.getState().anchorId).toBe('a')
    })

    it('select(undefined) clears anchorId', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')

      actions.select(undefined)

      expect(store.getState().anchorId).toBeUndefined()
    })

    it('toggleSelect does not change anchorId', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('a')

      actions.toggleSelect('b')

      expect(store.getState().anchorId).toBe('a')
    })

    it('rangeSelect selects forward range from anchor to target', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('b')

      actions.rangeSelect('d', ['a', 'b', 'c', 'd', 'e'])

      expect(store.getState().selectedIds).toEqual(new Set(['b', 'c', 'd']))
      expect(store.getState().selectedId).toBe('d')
      expect(store.getState().anchorId).toBe('b')
    })

    it('rangeSelect selects backward range from anchor to target', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('d')

      actions.rangeSelect('b', ['a', 'b', 'c', 'd', 'e'])

      expect(store.getState().selectedIds).toEqual(new Set(['b', 'c', 'd']))
      expect(store.getState().selectedId).toBe('b')
      expect(store.getState().anchorId).toBe('d')
    })

    it('rangeSelect falls back to select when no anchor', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)

      actions.rangeSelect('c', ['a', 'b', 'c', 'd'])

      expect(store.getState().selectedIds).toEqual(new Set(['c']))
      expect(store.getState().selectedId).toBe('c')
      expect(store.getState().anchorId).toBe('c')
    })

    it('rangeSelect falls back to select when anchor not in visible order', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('hidden')

      actions.rangeSelect('c', ['a', 'b', 'c', 'd'])

      expect(store.getState().selectedIds).toEqual(new Set(['c']))
      expect(store.getState().selectedId).toBe('c')
      expect(store.getState().anchorId).toBe('c')
    })

    it('consecutive rangeSelects re-range from stable anchor', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      const order = ['a', 'b', 'c', 'd', 'e']
      actions.select('b')

      actions.rangeSelect('d', order)
      expect(store.getState().selectedIds).toEqual(new Set(['b', 'c', 'd']))

      actions.rangeSelect('e', order)
      expect(store.getState().selectedIds).toEqual(new Set(['b', 'c', 'd', 'e']))
      expect(store.getState().anchorId).toBe('b')
    })

    it('rangeSelect with target equal to anchor selects single node', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      actions.select('b')

      actions.rangeSelect('b', ['a', 'b', 'c'])

      expect(store.getState().selectedIds).toEqual(new Set(['b']))
    })

    it('load clears stale anchorId', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ anchorId: 'deleted-node' })

      await actions.load()

      expect(store.getState().anchorId).toBeUndefined()
    })

    it('load preserves anchorId when node exists', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ anchorId: 'root' })

      await actions.load()

      expect(store.getState().anchorId).toBe('root')
    })

    it('load error does not modify anchorId', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network error'))
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({ anchorId: 'some-node' })

      await actions.load()

      expect(store.getState().anchorId).toBe('some-node')
    })

    describe('file attachment lifecycle', () => {
      it('uploads bytes, links the node, and selects it after confirmed persistence', async () => {
        mockAttachWithAuthoritativeReadback()
        const { store, nodeId } = await attachFileToRoot()

        expect(nodeId).toBeTruthy()
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
          '/workflow/wf-test/files',
          expect.objectContaining({ method: 'POST' }),
        )
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
          '/workflow/wf-test',
          expect.objectContaining({ method: 'PUT' }),
        )
        expect(store.getState().nodes[nodeId!]).toMatchObject({
          parent: 'root',
          title: uploadedFile.filename,
          file: uploadedFile.id,
        })
        expect(store.getState().selectedId).toBe(nodeId)
      })

      it('preserves concurrent local edits made while upload and readback are in flight', async () => {
        const bundle = createWorkflowStore('wf-test', mockFormatMessage)
        const { store, actions } = bundle

        vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
        vi.mocked(apiFetch).mockImplementation(async (url: string, o?: { method?: string; body?: string }) => {
          if (url.endsWith('/files') && o?.method === 'POST') {
            actions.updateNode('c1', { title: 'CONCURRENT' })
            return uploadedFile
          }
          if (url === '/workflow/wf-test' && o?.method === 'PUT') return {}
          if (url === '/workflow/wf-test') {
            const live = store.getState().nodes
            return { ...mockApiResponse, nodes: { ...live, c1: { ...live['c1'], title: 'Child' } } }
          }
          return {}
        })

        await actions.load()
        const nodeId = await actions.attachFileChild('root', workflowFile())

        expect(nodeId).toBeTruthy()
        expect(store.getState().nodes['c1']?.title).toBe('CONCURRENT')
        expect(findAttachmentNode(store.getState().nodes)?.file).toBe(uploadedFile.id)
      })

      it('clears undo history after confirmed persistence so no undo can orphan the uploaded bytes', async () => {
        mockAttachWithAuthoritativeReadback()
        const { store, actions } = await attachFileToRoot()
        const fileNode = findAttachmentNode(store.getState().nodes)

        actions.undo()

        expect(findAttachmentNode(store.getState().nodes)).toEqual(fileNode)
      })

      it('compensates by deleting uploaded bytes when server readback does not confirm the file link', async () => {
        mockAttachWithAuthoritativeReadback(body => ({ ...mockApiResponse, ...body, nodes: mockApiResponse.nodes }))

        const { store, nodeId } = await attachFileToRoot()

        expect(nodeId).toBeNull()
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/workflow/wf-test/files/file-1', { method: 'DELETE' })
        expect(findAttachmentNode(store.getState().nodes)).toBeUndefined()
        expect(store.getState().error).toBeNull()
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('workflowTree.attachment.linkPersistFailed')
      })

      it.each([
        {
          name: 'missing parent node',
          run: async () => {
            vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse)
            const storeBundle = createWorkflowStore('wf-test', mockFormatMessage)
            await storeBundle.actions.load()
            const nodeId = await storeBundle.actions.attachFileChild('missing-parent', workflowFile())
            return { ...storeBundle, nodeId }
          },
          expectedI18nKey: 'workflowTree.attachment.localCreateFailed',
        },
        {
          name: 'upload request rejected',
          run: async () => {
            vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse).mockRejectedValueOnce(new Error('upload failed'))
            const storeBundle = createWorkflowStore('wf-test', mockFormatMessage)
            await storeBundle.actions.load()
            await expect(storeBundle.actions.attachFileChild('root', workflowFile())).rejects.toThrow('upload failed')
            return { ...storeBundle, nodeId: null }
          },
          expectedI18nKey: 'workflowTree.attachment.uploadFailed',
        },
      ])('toasts and leaves nodes unchanged for pre-link failures: $name', async ({ run, expectedI18nKey }) => {
        const { store, nodeId } = await run()

        expect(nodeId).toBeNull()
        expect(store.getState().nodes).toEqual(mockApiResponse.nodes)
        expect(store.getState().error).toBeNull()
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expectedI18nKey)
        expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith(
          '/workflow/wf-test',
          expect.objectContaining({ method: 'PUT' }),
        )
        expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith(
          expect.stringContaining('/files/file-1'),
          expect.objectContaining({ method: 'DELETE' }),
        )
      })

      it.each([
        {
          name: 'delete succeeds, cleanup persists',
          outcomes: [new Error('persist failed'), {}, {}],
          expectedI18nKey: 'workflowTree.attachment.linkPersistFailed',
          expectedNode: undefined,
        },
        {
          name: 'delete fails during compensation',
          outcomes: [new Error('persist failed'), new Error('delete failed')],
          expectedI18nKey: 'workflowTree.attachment.deleteFailed',
          expectedNode: { file: uploadedFile.id },
        },
        {
          name: 'cleanup persistence fails after delete',
          outcomes: [new Error('persist failed'), {}, new Error('cleanup persist failed')],
          expectedI18nKey: 'workflowTree.attachment.removeFlushFailed',
          expectedNode: { file: uploadedFile.id },
        },
      ])(
        'toasts and enforces byte/link invariant for link-persist failures: $name',
        async ({ outcomes, expectedI18nKey, expectedNode }) => {
          mockLoadedWorkflowWithUploadedFile(...outcomes)

          const { store, nodeId } = await attachFileToRoot()
          const fileNode = findAttachmentNode(store.getState().nodes)

          expect(nodeId).toBeNull()
          expect(fileNode).toEqual(expectedNode === undefined ? undefined : expect.objectContaining(expectedNode))
          expect(store.getState().error).toBeNull()
          expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expectedI18nKey)
          expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(`/workflow/wf-test/files/${uploadedFile.id}`, {
            method: 'DELETE',
          })
        },
      )

      it('persists and confirms node-link removal before deleting attachment bytes', async () => {
        const { store, actions } = await loadWorkflowWithFileNode()

        actions.removeNode('file-node')
        await drainQueue()

        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(`/workflow/wf-test/files/${uploadedFile.id}`, {
          method: 'DELETE',
        })
        const putIndex = vi.mocked(apiFetch).mock.calls.findIndex(([, options]) => options?.method === 'PUT')
        const deleteIndex = vi.mocked(apiFetch).mock.calls.findIndex(([, options]) => options?.method === 'DELETE')
        expect(putIndex).toBeGreaterThanOrEqual(0)
        expect(deleteIndex).toBeGreaterThan(putIndex)
        expect(store.getState().nodes['file-node']).toBeUndefined()
      })

      it('clears the entire undo/redo history after successful byte deletion so the deleted-byte node cannot be resurrected', async () => {
        const { store, actions } = await loadWorkflowWithFileNode()

        actions.updateNode('c1', { title: 'edit-1' })
        actions.updateNode('c1', { title: 'edit-2' })

        actions.removeNode('file-node')
        await vi.waitFor(() => expect(store.getState().nodes['file-node']).toBeUndefined())

        actions.undo()
        expect(store.getState().nodes['file-node']).toBeUndefined()
        expect(store.getState().nodes['c1']?.title).toBe('edit-2')

        actions.undo()
        expect(store.getState().nodes['file-node']).toBeUndefined()

        actions.redo()
        expect(store.getState().nodes['file-node']).toBeUndefined()
      })

      it('keeps the accepted logical removal and toasts when byte cleanup fails', async () => {
        let persisted = workflowWithFileNode
        vi.mocked(apiFetch).mockImplementation(async (url: string, options?: { method?: string; body?: string }) => {
          if (url === '/workflow/wf-test' && options?.method === 'PUT') {
            persisted = { ...persisted, ...JSON.parse(String(options.body)) }
            return {}
          }
          if (url.startsWith('/workflow/wf-test/files/') && options?.method === 'DELETE') {
            throw new Error('S3 unavailable')
          }
          return persisted
        })
        const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
        await actions.load()

        actions.removeNode('file-node')
        await drainQueue()

        expect(store.getState().nodes['file-node']).toBeUndefined()
        expect(store.getState().error).toBeNull()
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('workflowTree.attachment.deleteFailed')
      })

      it('treats a 404 from byte deletion as idempotent success and still removes the node and persists', async () => {
        let persisted = workflowWithFileNode
        vi.mocked(apiFetch).mockImplementation(async (url: string, options?: { method?: string; body?: string }) => {
          if (url === '/workflow/wf-test' && options?.method === 'PUT') {
            persisted = { ...persisted, ...JSON.parse(String(options.body)) }
            return {}
          }
          if (url.startsWith('/workflow/wf-test/files/') && options?.method === 'DELETE') {
            throw new Error('Workflow file not found')
          }
          return persisted
        })
        const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
        await actions.load()

        actions.removeNode('file-node')
        await drainQueue()

        expect(store.getState().nodes['file-node']).toBeUndefined()
        expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
          '/workflow/wf-test',
          expect.objectContaining({ method: 'PUT' }),
        )
      })

      describe.each<{
        label: string
        fixture: typeof workflowWithFileNode
        act: (actions: WorkflowStoreActions) => void
        removedKey: string
      }>([
        {
          label: 'removeNode',
          fixture: workflowWithFileNode,
          act: actions => actions.removeNode('file-node'),
          removedKey: 'file-node',
        },
        {
          label: 'removeNodes',
          fixture: workflowWithFileNodes,
          act: actions => actions.removeNodes(new Set(['a', 'b', 'c'])),
          removedKey: 'a',
        },
      ])('$label — remove-flush reconciliation wiring', ({ fixture, act, removedKey }) => {
        it('recovers silently when flush fails once then succeeds on retry', async () => {
          let putCount = 0
          vi.mocked(apiFetch).mockImplementation(async (url: string, o?: { method?: string }) => {
            if (url.startsWith('/workflow/wf-test/files/') && o?.method === 'DELETE') return {}
            if (url === '/workflow/wf-test' && o?.method === 'PUT') {
              putCount++
              if (putCount === 1) throw new Error('network error')
              return {}
            }
            return fixture
          })
          const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
          await actions.load()

          act(actions)
          await drainQueue()

          expect(store.getState().nodes[removedKey]).toBeUndefined()
          expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
          await vi.waitFor(() => expect(putCount).toBeGreaterThanOrEqual(2), { timeout: 3000 })
          expect(store.getState().nodes[removedKey]).toBeUndefined()
        })

        it('toasts a durable error after all flush retries fail with a confirmed dangling file link', async () => {
          vi.useFakeTimers()
          try {
            let putCount = 0
            vi.mocked(apiFetch).mockImplementation(async (url: string, o?: { method?: string }) => {
              if (url.startsWith('/workflow/wf-test/files/') && o?.method === 'DELETE') return {}
              if (url === '/workflow/wf-test' && o?.method === 'PUT') {
                putCount++
                throw new Error('server down')
              }
              return fixture
            })
            const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
            await actions.load()

            act(actions)
            await vi.runAllTimersAsync()

            expect(store.getState().nodes[removedKey]).toBeUndefined()
            expect(vi.mocked(toast.error)).toHaveBeenCalledWith('workflowTree.attachment.removeFlushFailed')
            expect(putCount).toBeGreaterThanOrEqual(3)
          } finally {
            vi.useRealTimers()
          }
        })
      })

      it('clears history before byte cleanup so failed cleanup cannot resurrect removed links', async () => {
        let persisted = workflowWithFileNode
        vi.mocked(apiFetch).mockImplementation(async (url: string, o?: { method?: string; body?: string }) => {
          if (url === '/workflow/wf-test' && o?.method === 'PUT') {
            persisted = { ...persisted, ...JSON.parse(String(o.body)) }
            return {}
          }
          if (url.startsWith('/workflow/wf-test/files/') && o?.method === 'DELETE') throw new Error('s3 down')
          return persisted
        })
        const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
        await actions.load()

        actions.updateNode('c1', { title: 'edit-1' })
        actions.updateNode('c1', { title: 'edit-2' })

        actions.removeNode('file-node')
        await drainQueue()
        expect(store.getState().nodes['file-node']).toBeUndefined()

        actions.undo()
        expect(store.getState().nodes['file-node']).toBeUndefined()
        expect(store.getState().nodes['c1']?.title).toBe('edit-2')
      })

      it('checkpoints normally for non-attachment removals so undo correctly reverts the operation', async () => {
        vi.mocked(apiFetch).mockResolvedValueOnce(mockApiResponse).mockResolvedValue({})
        const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
        await actions.load()
        store.setState({
          nodes: {
            ...store.getState().nodes,
            c1: { ...store.getState().nodes.c1, checked: true },
          },
        })

        actions.removeNode('c1')
        expect(store.getState().nodes['c1']).toBeUndefined()

        actions.undo()

        expect(store.getState().nodes['c1']).toBeDefined()
        expect(store.getState().nodes['c1']?.title).toBe('Child')
        expect(store.getState().nodes['c1']?.checked).toBe(true)
      })

      it('bulk removal deletes each unique byte set and removes all node links', async () => {
        const { store, actions } = await loadWorkflowWithFileNodes()

        actions.removeNodes(new Set(['a', 'b', 'c']))
        await drainQueue()

        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/workflow/wf-test/files/file-a', { method: 'DELETE' })
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/workflow/wf-test/files/file-c', { method: 'DELETE' })
        // GET load + PUT + authoritative GET + two deduplicated DELETEs.
        expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(5)
        expect(store.getState().nodes).toEqual({ root: { id: 'root', title: 'Root', children: [] } })
      })

      it('bulk removal clears undo/redo history after successful byte deletion', async () => {
        const { store, actions } = await loadWorkflowWithFileNodes()

        actions.removeNodes(new Set(['a', 'b', 'c']))
        await vi.waitFor(() => expect(store.getState().nodes['a']).toBeUndefined())

        actions.undo()
        expect(store.getState().nodes['a']).toBeUndefined()
        actions.redo()
        expect(store.getState().nodes['a']).toBeUndefined()
      })

      it('bulk removal keeps accepted link removal, attempts every byte, and toasts on partial cleanup failure', async () => {
        let persisted = workflowWithFileNodes
        vi.mocked(apiFetch).mockImplementation(async (url: string, options?: { method?: string; body?: string }) => {
          if (url === '/workflow/wf-test' && options?.method === 'PUT') {
            persisted = { ...persisted, ...JSON.parse(String(options.body)) }
            return {}
          }
          if (url === '/workflow/wf-test/files/file-a' && options?.method === 'DELETE') {
            throw new Error('S3 unavailable')
          }
          if (url === '/workflow/wf-test/files/file-c' && options?.method === 'DELETE') return {}
          return persisted
        })
        const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
        await actions.load()

        actions.removeNodes(new Set(['a', 'b', 'c']))
        await drainQueue()

        expect(store.getState().nodes['a']).toBeUndefined()
        expect(store.getState().nodes['b']).toBeUndefined()
        expect(store.getState().nodes['c']).toBeUndefined()
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/workflow/wf-test/files/file-c', { method: 'DELETE' })
        expect(store.getState().error).toBeNull()
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith('workflowTree.attachment.deleteFailed')
      })

      it('bulk removal treats a not-found byte deletion as idempotent success and removes all nodes', async () => {
        let persisted = workflowWithFileNodes
        vi.mocked(apiFetch).mockImplementation(async (url: string, o?: { method?: string; body?: string }) => {
          if (url === '/workflow/wf-test/files/file-a' && o?.method === 'DELETE') return {}
          if (url === '/workflow/wf-test/files/file-c' && o?.method === 'DELETE')
            throw new Error('Workflow file not found')
          if (url === '/workflow/wf-test' && o?.method === 'PUT') {
            persisted = { ...persisted, ...JSON.parse(String(o.body)) }
            return {}
          }
          return persisted
        })
        const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
        await actions.load()

        actions.removeNodes(new Set(['a', 'b', 'c']))
        await drainQueue()

        expect(store.getState().nodes['a']).toBeUndefined()
        expect(store.getState().nodes['b']).toBeUndefined()
        expect(store.getState().nodes['c']).toBeUndefined()
        expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
          '/workflow/wf-test',
          expect.objectContaining({ method: 'PUT' }),
        )
      })

      it('keeps shared bytes while a surviving duplicate still references the file', async () => {
        const { store, actions } = await loadWorkflowWithFileNodes()

        actions.removeNode('a')
        await drainQueue()

        expect(store.getState().nodes.a).toBeUndefined()
        expect(store.getState().nodes.b?.file).toBe('file-a')
        expect(vi.mocked(apiFetch)).not.toHaveBeenCalledWith('/workflow/wf-test/files/file-a', { method: 'DELETE' })
      })

      it('replaces prompt subtrees through attachment-aware cleanup', async () => {
        let persisted = {
          ...mockApiResponse,
          nodes: {
            root: { id: 'root', title: 'Root', children: ['prompt-file', 'regular'], prompts: ['prompt-file'] },
            'prompt-file': { id: 'prompt-file', title: 'old.txt', parent: 'root', file: 'file-prompt' },
            regular: { id: 'regular', title: 'Regular', parent: 'root' },
          },
        }
        vi.mocked(apiFetch).mockImplementation(async (url: string, options?: { method?: string; body?: string }) => {
          if (url === '/workflow/wf-test' && options?.method === 'PUT') {
            persisted = { ...persisted, ...JSON.parse(String(options.body)) }
            return {}
          }
          if (url === '/workflow/wf-test/files/file-prompt' && options?.method === 'DELETE') return {}
          return persisted
        })
        const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
        await actions.load()

        expect(actions.importTextAsPrompts('root', 'Replacement prompt')).toBe(1)
        await drainQueue()

        expect(store.getState().nodes['prompt-file']).toBeUndefined()
        expect(store.getState().nodes.regular).toBeDefined()
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('/workflow/wf-test/files/file-prompt', { method: 'DELETE' })
      })
    })
  })

  describe('command-less lazy expansion', () => {
    it('splits only a command-less multi-paragraph node when expansion is requested', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({
        root: 'root',
        nodes: {
          root: { id: 'root', title: 'Root', children: ['plain', 'assigned'] },
          plain: { id: 'plain', parent: 'root', title: 'One\n\nTwo\n\nThree', children: [], collapsed: true },
          assigned: {
            id: 'assigned',
            parent: 'root',
            title: 'A\n\nB',
            command: '/chat hello',
            children: [],
            collapsed: true,
          },
        },
      })

      actions.toggleExpanded('plain')
      actions.toggleExpanded('assigned')

      const state = store.getState()
      expect(state.nodes.plain.children).toHaveLength(3)
      expect(state.nodes.plain.prompts).toEqual(state.nodes.plain.children)
      expect(state.nodes.assigned.children).toEqual([])
      expect(state.nodes.assigned.prompts).toBeUndefined()
      expect(state.expandedIds.has('plain')).toBe(true)
      expect(state.expandedIds.has('assigned')).toBe(true)
    })

    it('persists a lazy split immediately when expanding a command-less multi-paragraph node', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({})
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({
        root: 'root',
        nodes: {
          root: { id: 'root', title: 'Root', children: ['plain'] },
          plain: { id: 'plain', parent: 'root', title: 'One\n\nTwo', children: [], collapsed: true },
        },
      })

      actions.toggleExpanded('plain')

      await vi.waitFor(() =>
        expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
          '/workflow/wf-test',
          expect.objectContaining({ method: 'PUT' }),
        ),
      )
      const [, saveOptions] = vi.mocked(apiFetch).mock.calls.find(([url]) => url === '/workflow/wf-test') ?? []
      const persistedBody = JSON.parse(String(saveOptions?.body))
      expect(persistedBody.nodes.plain.children).toHaveLength(2)
      expect(persistedBody.nodes.plain.prompts).toEqual(persistedBody.nodes.plain.children)
    })

    it('does not replace authored children when a command-less text node already has non-prompt children', () => {
      const { store, actions } = createWorkflowStore('wf-test', mockFormatMessage)
      store.setState({
        root: 'root',
        nodes: {
          root: { id: 'root', title: 'Root', children: ['plain'] },
          plain: {
            id: 'plain',
            parent: 'root',
            title: 'One\n\nTwo',
            children: ['authored'],
            collapsed: true,
          },
          authored: { id: 'authored', parent: 'plain', title: 'Authored child', children: [] },
        },
      })

      actions.toggleExpanded('plain')

      expect(store.getState().nodes.plain.children).toEqual(['authored'])
      expect(store.getState().nodes.plain.prompts).toBeUndefined()
    })
  })
})
