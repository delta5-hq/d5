import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from '@shared/lib/store'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { bindExecuteAction } from '../workflow-store-execution'
import type { DebouncedPersister } from '../workflow-store-persistence'

vi.mock('@entities/workflow/lib', () => ({
  mergeWorkflowChanges: vi.fn(),
}))

vi.mock('../../api/execute-workflow-command', () => ({
  executeWorkflowCommand: vi.fn(),
}))

vi.mock('../execution-genie-bridge', () => ({
  notifyExecutionStarted: vi.fn(),
  notifyExecutionCompleted: vi.fn(),
  notifyExecutionAborted: vi.fn(),
}))

import { mergeWorkflowChanges } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../../api/execute-workflow-command'
import { notifyExecutionStarted, notifyExecutionCompleted, notifyExecutionAborted } from '../execution-genie-bridge'

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

function makeExecute(store: ReturnType<typeof makeStore>, persister: DebouncedPersister) {
  return bindExecuteAction(store, persister).executeCommand
}

function mockIdentityExecution(nodes: WorkflowStoreState['nodes']) {
  vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
  vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
    nodes,
    edges: {},
    root: Object.keys(nodes)[0] ?? '',
    share: { access: [] },
  })
}

const stubNode = { id: 'n1', title: 'Node 1', children: [] }
const stubNodeB = { id: 'n2', title: 'Node 2', children: [] }
const N1 = { n1: { id: 'n1' } } as WorkflowStoreState['nodes']
const N2 = {
  n1: { id: 'n1' } as WorkflowStoreState['nodes'][''],
  n2: { id: 'n2' } as WorkflowStoreState['nodes'][''],
}

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
      const execute = makeExecute(store, persister)

      const first = execute(stubNode, 'query')

      const secondResult = await execute(stubNode, 'query')
      expect(secondResult).toBe(false)
      expect(store.getState().executingNodeIds.has('n1')).toBe(true)
      expect(store.getState().executingNodeIds.size).toBe(1)

      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })
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

      const store = makeStore({ nodes: N2, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      const first = execute(stubNode, 'query')
      const second = execute(stubNodeB, 'query')

      expect(store.getState().executingNodeIds.has('n1')).toBe(true)
      expect(store.getState().executingNodeIds.has('n2')).toBe(true)
      expect(store.getState().executingNodeIds.size).toBe(2)

      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'A result' }, n2: { id: 'n2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })
      resolveFirst({ nodesChanged: {} })
      await first

      expect(store.getState().executingNodeIds.has('n1')).toBe(false)
      expect(store.getState().executingNodeIds.has('n2')).toBe(true)

      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
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
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(captured.has('n1')).toBe(true)
      expect(store.getState().executingNodeIds.size).toBe(0)
    })

    it('clears executingNodeIds after failed execution', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('boom'))

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().executingNodeIds.size).toBe(0)
    })
  })

  describe('pre-execution persistence', () => {
    it('flushes dirty state before executing', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1', isDirty: true })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(persister.flush).toHaveBeenCalled()
    })

    it('skips flush when state is not dirty', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1', isDirty: false })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(persister.flush).toHaveBeenCalledTimes(1)
    })

    it('aborts execution when pre-flush fails', async () => {
      const store = makeStore({ nodes: N1, root: 'n1', isDirty: true })
      const persister = makePersister()
      vi.mocked(persister.flush).mockResolvedValueOnce(false)
      const execute = makeExecute(store, persister)

      const result = await execute(stubNode, 'query')

      expect(result).toBe(false)
      expect(executeWorkflowCommand).not.toHaveBeenCalled()
    })

    it('captures store state after flush for API request', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
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
      const execute = makeExecute(store, persister)

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
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, n2: { id: 'n2' } },
        edges: { e1: { id: 'e1', start: 'n1', end: 'n2' } },
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, edges: {}, root: 'n1', isDirty: false })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

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

      const store = makeStore({ nodes: N2, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      const first = execute(stubNode, 'query')
      const second = execute(stubNodeB, 'query')

      vi.mocked(mergeWorkflowChanges).mockImplementationOnce((current, _response) => ({
        ...current,
        nodes: { ...current.nodes, n1: { id: 'n1', title: 'A done' }, childA: { id: 'childA' } },
      }))
      resolveFirst({ nodesChanged: {} })
      await first

      expect(store.getState().nodes).toHaveProperty('childA')

      vi.mocked(mergeWorkflowChanges).mockImplementationOnce((current, _response) => ({
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
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(persister.flush).toHaveBeenCalled()
    })

    it('returns false when post-execution persist throws', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      vi.mocked(persister.flush).mockRejectedValueOnce(new Error('persist failed'))
      const execute = makeExecute(store, persister)

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
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n2: { id: 'n2' } },
        edges: {},
        root: 'n2',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', selectedId: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('preserves selectedId when selected node survives merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { n1: { id: 'n1', title: 'Updated' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
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
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('n1')
    })

    it('leaves selectedId unchanged when nothing was selected', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('preserves selectedId on execution failure', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('server error'))

      const store = makeStore({ nodes: N1, root: 'n1', selectedId: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('n1')
    })

    it('evicts stale selectedIds when nodes removed by merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n2: { id: 'n2' } } })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n2: { id: 'n2' } },
        edges: {},
        root: 'n2',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: N1,
        root: 'n1',
        selectedIds: new Set(['n1']),
      })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedIds.size).toBe(0)
    })

    it('preserves surviving selectedIds after merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, n2: { id: 'n2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: N2,
        root: 'n1',
        selectedIds: new Set(['n1', 'n2']),
      })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedIds).toEqual(new Set(['n1', 'n2']))
    })

    it('partially evicts stale entries from selectedIds after merge', async () => {
      const threeNodes = {
        n1: { id: 'n1' },
        n2: { id: 'n2' },
        n3: { id: 'n3' },
      } as WorkflowStoreState['nodes']
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, n3: { id: 'n3' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: threeNodes,
        root: 'n1',
        selectedIds: new Set(['n1', 'n2', 'n3']),
      })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedIds).toEqual(new Set(['n1', 'n3']))
    })

    it('keeps empty selectedIds unchanged on execution failure', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('fail'))

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedIds.size).toBe(0)
    })

    it('preserves populated selectedIds on execution failure', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('fail'))

      const store = makeStore({
        nodes: N1,
        root: 'n1',
        selectedIds: new Set(['n1']),
      })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedIds).toEqual(new Set(['n1']))
    })

    it('clears anchorId when anchor node removed by merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n2: { id: 'n2' } },
        edges: {},
        root: 'n2',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', anchorId: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().anchorId).toBeUndefined()
    })

    it('preserves anchorId when anchor node survives merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'Updated' }, n2: { id: 'n2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: { n1: { id: 'n1' }, n2: { id: 'n2' } } as WorkflowStoreState['nodes'],
        root: 'n1',
        anchorId: 'n1',
      })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().anchorId).toBe('n1')
    })

    it('leaves anchorId undefined when no anchor was set', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().anchorId).toBeUndefined()
    })

    it('preserves anchorId on execution failure', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('server error'))

      const store = makeStore({ nodes: N1, root: 'n1', anchorId: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().anchorId).toBe('n1')
    })
  })

  it('returns true on successful execution', async () => {
    mockIdentityExecution(N1)

    const store = makeStore({ nodes: N1, root: 'n1' })
    const persister = makePersister()
    const execute = makeExecute(store, persister)

    const result = await execute(stubNode, 'query')

    expect(result).toBe(true)
  })

  it('returns false on API failure', async () => {
    vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('network error'))

    const store = makeStore({ nodes: N1, root: 'n1' })
    const persister = makePersister()
    const execute = makeExecute(store, persister)

    const result = await execute(stubNode, 'query')

    expect(result).toBe(false)
  })

  describe('genie state bridge integration', () => {
    it('notifies bridge of execution start', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(notifyExecutionStarted).toHaveBeenCalledWith('n1')
      expect(notifyExecutionStarted).toHaveBeenCalledTimes(1)
    })

    it('notifies bridge of successful completion', async () => {
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(notifyExecutionCompleted).toHaveBeenCalledWith('n1', true)
      expect(notifyExecutionCompleted).toHaveBeenCalledTimes(1)
    })

    it('notifies bridge of failed completion on API error', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('boom'))

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(notifyExecutionCompleted).toHaveBeenCalledWith('n1', false)
    })

    it('notifies bridge of failed completion on merge error', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockImplementation(() => {
        throw new Error('merge explosion')
      })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(notifyExecutionCompleted).toHaveBeenCalledWith('n1', false)
    })

    it('notifies bridge of failed completion when post-persist throws', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()
      vi.mocked(persister.flush).mockRejectedValueOnce(new Error('persist failed'))
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(notifyExecutionCompleted).toHaveBeenCalledWith('n1', false)
    })

    it('notifies abort (not failure) when AbortError is thrown', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(notifyExecutionAborted).toHaveBeenCalledWith('n1')
      expect(notifyExecutionAborted).toHaveBeenCalledTimes(1)
      expect(notifyExecutionCompleted).not.toHaveBeenCalled()
    })

    it.each([
      ['Error', new Error('network error')],
      ['DOMException with non-AbortError name', new DOMException('not allowed', 'NotAllowedError')],
      ['TypeError', new TypeError('unexpected')],
    ])('notifies failure (not abort) when a %s is thrown', async (_label, error) => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(error)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(notifyExecutionCompleted).toHaveBeenCalledWith('n1', false)
      expect(notifyExecutionAborted).not.toHaveBeenCalled()
    })

    it('invokes bridge notifications in correct order', async () => {
      const callOrder: string[] = []
      const store = makeStore({ nodes: N1, root: 'n1' })
      const persister = makePersister()

      vi.mocked(notifyExecutionStarted).mockImplementation(() => {
        callOrder.push('bridge:started')
      })

      vi.mocked(executeWorkflowCommand).mockImplementation(async () => {
        callOrder.push('api:execute')
        return { nodesChanged: {} }
      })

      vi.mocked(mergeWorkflowChanges).mockImplementation((current, _response) => {
        callOrder.push('store:merge')
        return current
      })

      vi.mocked(persister.flush).mockImplementation(async () => {
        callOrder.push('store:persist')
        return true
      })

      vi.mocked(notifyExecutionCompleted).mockImplementation(() => {
        callOrder.push('bridge:completed')
      })

      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(callOrder).toEqual(['bridge:started', 'api:execute', 'store:merge', 'store:persist', 'bridge:completed'])
    })

    it('handles concurrent executions with independent genie notifications', async () => {
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

      const store = makeStore({ nodes: N2, root: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      const first = execute(stubNode, 'query')
      const second = execute(stubNodeB, 'query')

      expect(notifyExecutionStarted).toHaveBeenCalledWith('n1')
      expect(notifyExecutionStarted).toHaveBeenCalledWith('n2')
      expect(notifyExecutionStarted).toHaveBeenCalledTimes(2)

      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: N2,
        edges: {},
        root: 'n1',
        share: { access: [] },
      })
      resolveFirst({ nodesChanged: {} })
      await first

      expect(notifyExecutionCompleted).toHaveBeenCalledWith('n1', true)

      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: N2,
        edges: {},
        root: 'n1',
        share: { access: [] },
      })
      resolveSecond({ nodesChanged: {} })
      await second

      expect(notifyExecutionCompleted).toHaveBeenCalledWith('n2', true)
      expect(notifyExecutionCompleted).toHaveBeenCalledTimes(2)
    })
  })

  describe('abortExecution', () => {
    describe('AbortSignal delivery', () => {
      it('passes a fresh non-aborted AbortSignal to executeWorkflowCommand', async () => {
        let capturedSignal: AbortSignal | undefined
        vi.mocked(executeWorkflowCommand).mockImplementationOnce(async req => {
          capturedSignal = (req as { signal?: AbortSignal }).signal
          return { nodesChanged: {} }
        })
        vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
          nodes: N1,
          edges: {},
          root: 'n1',
          share: { access: [] },
        })

        const store = makeStore({ nodes: N1, root: 'n1' })
        const execute = makeExecute(store, makePersister())
        await execute(stubNode, 'query')

        expect(capturedSignal).toBeInstanceOf(AbortSignal)
        expect(capturedSignal?.aborted).toBe(false)
      })

      it('each concurrent execution receives a distinct AbortSignal', async () => {
        const capturedSignals: AbortSignal[] = []
        let resolveFirst!: (value: { nodesChanged: Record<string, never> }) => void
        let resolveSecond!: (value: { nodesChanged: Record<string, never> }) => void

        vi.mocked(executeWorkflowCommand)
          .mockImplementationOnce(
            req =>
              new Promise(resolve => {
                capturedSignals.push((req as { signal?: AbortSignal }).signal!)
                resolveFirst = resolve
              }),
          )
          .mockImplementationOnce(
            req =>
              new Promise(resolve => {
                capturedSignals.push((req as { signal?: AbortSignal }).signal!)
                resolveSecond = resolve
              }),
          )

        const store = makeStore({ nodes: N2, root: 'n1' })
        const { executeCommand } = bindExecuteAction(store, makePersister())

        const first = executeCommand(stubNode, 'query')
        const second = executeCommand(stubNodeB, 'query')

        expect(capturedSignals[0]).not.toBe(capturedSignals[1])

        vi.mocked(mergeWorkflowChanges).mockReturnValue({
          nodes: N2,
          edges: {},
          root: 'n1',
          share: { access: [] },
        })
        resolveFirst({ nodesChanged: {} })
        resolveSecond({ nodesChanged: {} })
        await Promise.all([first, second])
      })
    })

    describe('abort signal propagation', () => {
      it('marks signal as aborted immediately when abortExecution is called mid-flight', async () => {
        let capturedSignal: AbortSignal | undefined
        let resolveExec!: (value: { nodesChanged: Record<string, never> }) => void

        vi.mocked(executeWorkflowCommand).mockImplementationOnce(
          req =>
            new Promise(resolve => {
              capturedSignal = (req as { signal?: AbortSignal }).signal
              resolveExec = resolve
            }),
        )

        const store = makeStore({ nodes: N1, root: 'n1' })
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister())

        const pending = executeCommand(stubNode, 'query')
        abortExecution('n1')

        expect(capturedSignal?.aborted).toBe(true)

        resolveExec({ nodesChanged: {} })
        await pending
      })

      it('aborting one node does not abort the signal for a concurrently executing node', async () => {
        const capturedSignals: AbortSignal[] = []
        let resolveFirst!: (value: { nodesChanged: Record<string, never> }) => void
        let resolveSecond!: (value: { nodesChanged: Record<string, never> }) => void

        vi.mocked(executeWorkflowCommand)
          .mockImplementationOnce(
            req =>
              new Promise(resolve => {
                capturedSignals.push((req as { signal?: AbortSignal }).signal!)
                resolveFirst = resolve
              }),
          )
          .mockImplementationOnce(
            req =>
              new Promise(resolve => {
                capturedSignals.push((req as { signal?: AbortSignal }).signal!)
                resolveSecond = resolve
              }),
          )

        const store = makeStore({ nodes: N2, root: 'n1' })
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister())

        const first = executeCommand(stubNode, 'query')
        const second = executeCommand(stubNodeB, 'query')

        abortExecution('n1')

        expect(capturedSignals[0]?.aborted).toBe(true)
        expect(capturedSignals[1]?.aborted).toBe(false)

        vi.mocked(mergeWorkflowChanges).mockReturnValue({
          nodes: N2,
          edges: {},
          root: 'n1',
          share: { access: [] },
        })
        resolveFirst({ nodesChanged: {} })
        resolveSecond({ nodesChanged: {} })
        await Promise.all([first, second])
      })
    })

    describe('controller lifecycle', () => {
      it('removes node from executingNodeIds after aborted execution resolves', async () => {
        let resolveExec!: (value: { nodesChanged: Record<string, never> }) => void
        vi.mocked(executeWorkflowCommand).mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveExec = resolve
            }),
        )

        const store = makeStore({ nodes: N1, root: 'n1' })
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister())

        const pending = executeCommand(stubNode, 'query')
        abortExecution('n1')
        resolveExec({ nodesChanged: {} })
        await pending

        expect(store.getState().executingNodeIds.size).toBe(0)
      })

      it('allows the same node to be re-executed after a completed abort', async () => {
        let resolveFirst!: (value: { nodesChanged: Record<string, never> }) => void
        vi.mocked(executeWorkflowCommand).mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveFirst = resolve
            }),
        )

        const store = makeStore({ nodes: N1, root: 'n1' })
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister())

        const first = executeCommand(stubNode, 'query')
        abortExecution('n1')
        resolveFirst({ nodesChanged: {} })
        await first

        mockIdentityExecution(N1)
        const second = await executeCommand(stubNode, 'query')
        expect(second).toBe(true)
      })

      it('is safe to call abortExecution for a node that has never executed', () => {
        const { abortExecution } = bindExecuteAction(makeStore({ nodes: N1, root: 'n1' }), makePersister())
        expect(() => abortExecution('unknown-node')).not.toThrow()
      })

      it('is safe to call abortExecution for a node after its execution completed normally', async () => {
        mockIdentityExecution(N1)
        const store = makeStore({ nodes: N1, root: 'n1' })
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister())

        await executeCommand(stubNode, 'query')

        expect(() => abortExecution('n1')).not.toThrow()
      })
    })
  })
})
