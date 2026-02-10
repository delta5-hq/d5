import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from '@shared/lib/store'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { bindExecuteAction } from '../workflow-store-execution'
import type { DebouncedPersister } from '../workflow-store-persistence'

vi.mock('@entities/workflow/lib', () => ({
  mergeWorkflowNodes: vi.fn(),
}))

vi.mock('../../api/execute-workflow-command', () => ({
  executeWorkflowCommand: vi.fn(),
}))

import { mergeWorkflowNodes } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../../api/execute-workflow-command'

function makeStore(overrides: Partial<WorkflowStoreState> = {}) {
  return createStore<WorkflowStoreState>({
    ...INITIAL_WORKFLOW_STATE,
    workflowId: 'wf-test',
    ...overrides,
  })
}

function makePersister(): DebouncedPersister {
  return { schedule: vi.fn(), flush: vi.fn().mockResolvedValue(true), cancel: vi.fn(), destroy: vi.fn() }
}

function mockIdentityExecution(nodes: WorkflowStoreState['nodes']) {
  vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
  vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
    nodes,
    edges: {},
    root: Object.keys(nodes)[0] ?? '',
    share: { access: [] },
  })
}

const stubNode = { id: 'n1', title: 'Node 1', children: [] }
const stubNodeB = { id: 'n2', title: 'Node 2', children: [] }
const N1 = { n1: { id: 'n1' } } as WorkflowStoreState['nodes']

describe('bindExecuteAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('concurrency guard', () => {
    it('rejects re-execution of same node while already executing', async () => {
      let resolveFirst!: (value: { nodesChanged: Record<string, never> }) => void
      vi.mocked(executeWorkflowCommand).mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = resolve
          }),
      )

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      const first = execute(stubNode, 'query')

      const secondResult = await execute(stubNode, 'query')
      expect(secondResult).toBe(false)
      expect(store.getState().executingNodeIds.has('n1')).toBe(true)
      expect(store.getState().executingNodeIds.size).toBe(1)

      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })
      resolveFirst({ nodesChanged: {} })
      await first

      expect(store.getState().executingNodeIds.size).toBe(0)
    })

    it('allows concurrent execution of different nodes', async () => {
      let resolveFirst!: (value: { nodesChanged: Record<string, never> }) => void
      let resolveSecond!: (value: { nodesChanged: Record<string, never> }) => void
      vi.mocked(executeWorkflowCommand)
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveFirst = resolve
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveSecond = resolve
            }),
        )

      const twoNodes = {
        n1: { id: 'n1' } as WorkflowStoreState['nodes'][''],
        n2: { id: 'n2' } as WorkflowStoreState['nodes'][''],
      }
      const store = makeStore({ nodes: twoNodes, root: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      const first = execute(stubNode, 'query')
      const second = execute(stubNodeB, 'query')

      expect(store.getState().executingNodeIds.has('n1')).toBe(true)
      expect(store.getState().executingNodeIds.has('n2')).toBe(true)
      expect(store.getState().executingNodeIds.size).toBe(2)

      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'A result' }, n2: { id: 'n2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })
      resolveFirst({ nodesChanged: {} })
      await first

      expect(store.getState().executingNodeIds.has('n1')).toBe(false)
      expect(store.getState().executingNodeIds.has('n2')).toBe(true)

      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'A result' }, n2: { id: 'n2', title: 'B result' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })
      resolveSecond({ nodesChanged: {} })
      await second

      expect(store.getState().executingNodeIds.size).toBe(0)
    })

    it('tracks node in executingNodeIds during API call and clears after', async () => {
      let captured = new Set<string>()
      vi.mocked(executeWorkflowCommand).mockImplementationOnce(async () => {
        captured = new Set(store.getState().executingNodeIds)
        return { nodesChanged: {} }
      })
      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(captured.has('n1')).toBe(true)
      expect(store.getState().executingNodeIds.size).toBe(0)
    })

    it('clears executingNodeIds after failed execution', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('boom'))

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().executingNodeIds.size).toBe(0)
    })
  })

  describe('pre-execution persistence', () => {
    it('flushes dirty state before executing', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1', isDirty: true })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(persister.flush).toHaveBeenCalled()
    })

    it('skips flush when state is not dirty', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1', isDirty: false })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      /* only post-execution flush */
      expect(persister.flush).toHaveBeenCalledTimes(1)
    })

    it('aborts execution when pre-flush fails', async () => {
      const store = makeStore({ nodes: N1, root: 'n1', isDirty: true })
      const persister = makePersister()
      vi.mocked(persister.flush).mockResolvedValueOnce(false)
      const execute = bindExecuteAction(store, persister)

      const result = await execute(stubNode, 'query')

      expect(result).toBe(false)
      expect(executeWorkflowCommand).not.toHaveBeenCalled()
    })

    it('captures store state after flush for API request', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'post-flush' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: { n1: { id: 'n1', title: 'pre-flush' } } as WorkflowStoreState['nodes'],
        root: 'n1',
        isDirty: true,
      })
      const persister = makePersister()
      vi.mocked(persister.flush).mockImplementationOnce(async () => {
        store.setState({ nodes: { n1: { id: 'n1', title: 'post-flush' } } as WorkflowStoreState['nodes'] })
        return true
      })
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(executeWorkflowCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowNodes: expect.objectContaining({ n1: expect.objectContaining({ title: 'post-flush' }) }),
        }),
      )
    })
  })

  describe('response merging', () => {
    it('applies merged nodes, edges, and root to store and marks dirty', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n2: { id: 'n2' } } })
      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, n2: { id: 'n2' } },
        edges: { e1: { id: 'e1', start: 'n1', end: 'n2' } },
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, edges: {}, root: 'n1', isDirty: false })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      const state = store.getState()
      expect(state.nodes).toEqual({ n1: { id: 'n1' }, n2: { id: 'n2' } })
      expect(state.edges).toEqual({ e1: { id: 'e1', start: 'n1', end: 'n2' } })
      expect(state.root).toBe('n1')
      expect(state.isDirty).toBe(true)
    })

    it('uses fresh store state as merge base for concurrent responses', async () => {
      let resolveFirst!: (value: { nodesChanged: Record<string, never> }) => void
      let resolveSecond!: (value: { nodesChanged: Record<string, never> }) => void
      vi.mocked(executeWorkflowCommand)
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveFirst = resolve
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveSecond = resolve
            }),
        )

      const twoNodes = {
        n1: { id: 'n1' } as WorkflowStoreState['nodes'][''],
        n2: { id: 'n2' } as WorkflowStoreState['nodes'][''],
      }
      const store = makeStore({ nodes: twoNodes, root: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      const first = execute(stubNode, 'query')
      const second = execute(stubNodeB, 'query')

      vi.mocked(mergeWorkflowNodes).mockImplementationOnce((current, _response) => ({
        ...current,
        nodes: { ...current.nodes, n1: { id: 'n1', title: 'A done' }, childA: { id: 'childA' } },
      }))
      resolveFirst({ nodesChanged: {} })
      await first

      expect(store.getState().nodes).toHaveProperty('childA')

      vi.mocked(mergeWorkflowNodes).mockImplementationOnce((current, _response) => ({
        ...current,
        nodes: { ...current.nodes, n2: { id: 'n2', title: 'B done' }, childB: { id: 'childB' } },
      }))
      resolveSecond({ nodesChanged: {} })
      await second

      const finalNodes = store.getState().nodes
      expect(finalNodes).toHaveProperty('childA')
      expect(finalNodes).toHaveProperty('childB')
      expect(finalNodes.n1).toEqual({ id: 'n1', title: 'A done' })
      expect(finalNodes.n2).toEqual({ id: 'n2', title: 'B done' })
    })

    it('persists merged state after execution', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1', isDirty: false })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(persister.flush).toHaveBeenCalled()
    })

    it('returns false when post-execution persist throws', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      vi.mocked(persister.flush).mockRejectedValueOnce(new Error('persist failed'))
      const execute = bindExecuteAction(store, persister)

      const result = await execute(stubNode, 'query')

      expect(result).toBe(false)
      /* state was already merged before persist attempt */
      expect(store.getState().nodes).toEqual(N1)
      expect(store.getState().executingNodeIds.size).toBe(0)
    })
  })

  describe('selection management', () => {
    it('clears selectedId when selected node removed by merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n2: { id: 'n2' } } })
      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
        nodes: { n2: { id: 'n2' } },
        edges: {},
        root: 'n2',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', selectedId: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('preserves selectedId when selected node survives merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { n1: { id: 'n1', title: 'Updated' } },
      })
      vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'Updated' }, n2: { id: 'n2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: { n1: { id: 'n1' }, n2: { id: 'n2' } } as WorkflowStoreState['nodes'],
        root: 'n1',
        selectedId: 'n1',
      })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('n1')
    })

    it('leaves selectedId unchanged when nothing was selected', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('preserves selectedId on execution failure', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('server error'))

      const store = makeStore({ nodes: N1, root: 'n1', selectedId: 'n1' })
      const persister = makePersister()
      const execute = bindExecuteAction(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('n1')
    })
  })

  it('returns true on successful execution', async () => {
    mockIdentityExecution(N1)

    const store = makeStore({ nodes: N1, root: 'n1' })
    const persister = makePersister()
    const execute = bindExecuteAction(store, persister)

    const result = await execute(stubNode, 'query')

    expect(result).toBe(true)
  })

  it('returns false on API failure', async () => {
    vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('network error'))

    const store = makeStore({ nodes: N1, root: 'n1' })
    const persister = makePersister()
    const execute = bindExecuteAction(store, persister)

    const result = await execute(stubNode, 'query')

    expect(result).toBe(false)
  })
})
