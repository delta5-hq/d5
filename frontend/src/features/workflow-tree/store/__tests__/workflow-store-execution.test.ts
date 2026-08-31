import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStore } from '@shared/lib/store'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { bindExecuteAction } from '../workflow-store-execution'
import type { DebouncedPersister } from '../workflow-store-persistence'
import type { NodeData } from '@shared/base-types'

vi.mock('@entities/workflow/lib', () => ({
  mergeWorkflowChanges: vi.fn(),
  isPromptNode: vi.fn(() => false),
}))

vi.mock('../../api/execute-workflow-command', () => ({
  executeWorkflowCommand: vi.fn(),
}))

vi.mock('../execution-genie-bridge', () => ({
  notifyExecutionStarted: vi.fn(),
  notifyExecutionCompleted: vi.fn(),
  notifyExecutionAborted: vi.fn(),
}))

vi.mock('../../core/tree-animation-store', () => ({
  scheduleTreeAnimation: vi.fn(),
  clearTreeAnimation: vi.fn(),
}))

import { mergeWorkflowChanges } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../../api/execute-workflow-command'
import { notifyExecutionStarted, notifyExecutionCompleted, notifyExecutionAborted } from '../execution-genie-bridge'
import { clearTreeAnimation, scheduleTreeAnimation } from '../../core/tree-animation-store'
import { SPARK_DURATION_MS } from '../../core/constants'

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
  const firstNodeId = Object.keys(nodes)[0] ?? 'n1'
  vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
    nodesChanged: { [firstNodeId]: nodes[firstNodeId] },
  })
  vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
    nodes,
    edges: {},
    root: firstNodeId,
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
      let resolveFirst!: (value: { nodesChanged: Record<string, NodeData> }) => void
      let resolveSecond!: (value: { nodesChanged: Record<string, NodeData> }) => void
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
      resolveFirst({ nodesChanged: { n1: { id: 'n1' } as NodeData } })
      await first

      expect(store.getState().nodes).toHaveProperty('childA')

      vi.mocked(mergeWorkflowChanges).mockImplementationOnce((current, _response) => ({
        ...current,
        nodes: { ...current.nodes, n2: { id: 'n2', title: 'B done' }, childB: { id: 'childB' } },
      }))
      resolveSecond({ nodesChanged: { n2: { id: 'n2' } as NodeData } })
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
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: N1.n1 } })
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

    it('selects the error child node on API failure, replacing any prior selection', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('server error'))

      const store = makeStore({ nodes: { n1: { id: 'n1', children: [] } }, root: 'n1', selectedId: 'n1' })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      const children = store.getState().nodes['n1'].children ?? []
      expect(children).toHaveLength(1)
      expect(store.getState().selectedId).toBe(children[0])
    })

    it('preserves selectedId when execution is aborted (no error child created)', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))

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
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: { id: 'n1' } } })
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
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: { id: 'n1' } } })
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

    it('clears populated selectedIds when selecting an error output', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('fail'))

      const store = makeStore({
        nodes: N1,
        root: 'n1',
        selectedIds: new Set(['n1']),
      })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(stubNode, 'query')

      expect(store.getState().selectedIds).toEqual(new Set())
    })

    it('clears anchorId when anchor node removed by merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: { id: 'n1' } } })
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
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: { id: 'n1' } } })
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

  it('creates an error child node in the store on API failure', async () => {
    vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('server boom'))

    const store = makeStore({ nodes: { n1: { id: 'n1', children: [] } }, root: 'n1' })
    const persister = makePersister()
    const execute = makeExecute(store, persister)

    await execute({ id: 'n1', title: 'Node 1', children: [] }, 'query')

    const storeNodes = store.getState().nodes
    const parentChildren = storeNodes['n1'].children ?? []
    expect(parentChildren).toHaveLength(1)
    const errorNodeId = parentChildren[0]
    expect(storeNodes[errorNodeId].title).toBe('Error: server boom')
    expect(storeNodes[errorNodeId].parent).toBe('n1')
    expect(store.getState().expandedIds.has('n1')).toBe(true)
  })

  it('does not create a local error child after backend response is received', async () => {
    vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: { id: 'n1', children: [] } } })
    vi.mocked(mergeWorkflowChanges).mockImplementationOnce(() => {
      throw new Error('merge failed')
    })

    const store = makeStore({ nodes: { n1: { id: 'n1', children: [] } }, root: 'n1' })
    const persister = makePersister()
    const execute = makeExecute(store, persister)

    await execute({ id: 'n1', title: 'Node 1', children: [] }, 'query')

    expect(store.getState().nodes['n1'].children).toEqual([])
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
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: N1.n1 } })
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
        return { nodesChanged: { n1: N1.n1 } }
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

  describe('new direct child auto-selection', () => {
    it('selects the single new child produced by the executed node', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1', parent: 'n1' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, child1: { id: 'child1', parent: 'n1' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('child1')
    })

    it('selects the first new child when multiple new children are produced', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: {
          child1: { id: 'child1', parent: 'n1' },
          child2: { id: 'child2', parent: 'n1' },
        },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, child1: { id: 'child1' }, child2: { id: 'child2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      const selected = store.getState().selectedId
      expect(['child1', 'child2']).toContain(selected)
    })

    it('does not auto-select a node that already existed before execution', async () => {
      const preExistingChild = { id: 'child1', parent: 'n1' } as NodeData
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: preExistingChild },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, child1: preExistingChild },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: { n1: { id: 'n1' }, child1: preExistingChild } as WorkflowStoreState['nodes'],
        root: 'n1',
      })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('does not auto-select a new child whose parent is a different node', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1', parent: 'n2' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, n2: { id: 'n2' }, child1: { id: 'child1', parent: 'n2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N2, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('clears runtime multi-selection but preserves checked state when auto-selecting a new child', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1', parent: 'n1' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', checked: true }, child1: { id: 'child1', parent: 'n1' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: { n1: { ...N1.n1, checked: true } },
        root: 'n1',
        selectedIds: new Set(['n1']),
      })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('child1')
      expect(store.getState().selectedIds.size).toBe(0)
      expect(store.getState().nodes.n1.checked).toBe(true)
    })

    it('clears selectedIds when auto-selecting among multiple new children', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: {
          child1: { id: 'child1', parent: 'n1' },
          child2: { id: 'child2', parent: 'n1' },
        },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, child1: { id: 'child1' }, child2: { id: 'child2' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', selectedIds: new Set(['n1']) })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      const selected = store.getState().selectedId
      expect(['child1', 'child2']).toContain(selected)
      expect(store.getState().selectedIds.size).toBe(0)
    })

    it('does not auto-select when nodesChanged contains only updated existing nodes', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { n1: { id: 'n1', title: 'Updated' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'Updated' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('auto-selects the single new child even when the previously selected node was removed by the merge', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1', parent: 'n1' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { child1: { id: 'child1', parent: 'n1' } },
        edges: {},
        root: 'child1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', selectedId: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('child1')
    })

    it('auto-selects the single new child when nodesChanged also contains updated existing nodes', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: {
          n1: { id: 'n1', title: 'Updated' },
          child1: { id: 'child1', parent: 'n1' },
        },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'Updated' }, child1: { id: 'child1', parent: 'n1' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('child1')
    })

    it('does not auto-select a node in nodesChanged that has no parent field', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, child1: { id: 'child1' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('expands the executed node and sets collapsed:false when a single new child is produced', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1', parent: 'n1' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: { id: 'n1', children: ['child1'] } as NodeData,
          child1: { id: 'child1', parent: 'n1', children: [] } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', expandedIds: new Set<string>() })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().expandedIds.has('n1')).toBe(true)
      expect(store.getState().nodes['n1']?.collapsed).toBe(false)
    })

    it('does not expand the executed node when nodesChanged has no new children', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { n1: { id: 'n1', title: 'Updated' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1', title: 'Updated' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', expandedIds: new Set<string>() })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().expandedIds.has('n1')).toBe(false)
    })

    it('expands the executed node and sets collapsed:false when multiple new children are produced', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: {
          child1: { id: 'child1', parent: 'n1' } as NodeData,
          child2: { id: 'child2', parent: 'n1' } as NodeData,
        },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: { id: 'n1', children: ['child1', 'child2'] } as NodeData,
          child1: { id: 'child1', parent: 'n1', children: [] } as NodeData,
          child2: { id: 'child2', parent: 'n1', children: [] } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', expandedIds: new Set<string>() })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().expandedIds.has('n1')).toBe(true)
      expect(store.getState().nodes['n1']?.collapsed).toBe(false)
    })

    it('does not expand the executed node when nodesChanged contains only pre-existing children', async () => {
      const existingChild = { id: 'child1', parent: 'n1', children: [] } as NodeData
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: existingChild },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' } as NodeData, child1: existingChild },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({
        nodes: { n1: { id: 'n1' } as NodeData, child1: existingChild } as WorkflowStoreState['nodes'],
        root: 'n1',
        expandedIds: new Set<string>(),
      })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().expandedIds.has('n1')).toBe(false)
    })

    it('does not expand the executed node when new children belong to a different parent', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: {
          child1: { id: 'child1', parent: 'n2' } as NodeData,
          child2: { id: 'child2', parent: 'n2' } as NodeData,
        },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: { id: 'n1' } as NodeData,
          n2: { id: 'n2', children: ['child1', 'child2'] } as NodeData,
          child1: { id: 'child1', parent: 'n2', children: [] } as NodeData,
          child2: { id: 'child2', parent: 'n2', children: [] } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N2, root: 'n1', expandedIds: new Set<string>() })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().expandedIds.has('n1')).toBe(false)
    })
  })

  describe('(no output) node creation on empty response', () => {
    it('creates a (no output) child node when backend returns empty nodesChanged', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })

      const store = makeStore({ nodes: { n1: { id: 'n1' } }, root: 'n1' })
      await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      const children = store.getState().nodes['n1'].children ?? []
      expect(children).toHaveLength(1)
      expect(store.getState().nodes[children[0]].title).toBe('(no output)')
      expect(store.getState().nodes[children[0]].parent).toBe('n1')
    })

    it('auto-selects the (no output) child without clearing checked state', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })

      const store = makeStore({
        nodes: { n1: { id: 'n1', checked: true } },
        root: 'n1',
        selectedIds: new Set(['n1']),
      })
      await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      const children = store.getState().nodes['n1'].children ?? []
      expect(store.getState().selectedId).toBe(children[0])
      expect(store.getState().selectedIds.size).toBe(0)
      expect(store.getState().nodes.n1.checked).toBe(true)
    })

    it('expands the executed node when backend returns empty nodesChanged', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })

      const store = makeStore({ nodes: { n1: { id: 'n1' } }, root: 'n1', expandedIds: new Set<string>() })
      await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      expect(store.getState().expandedIds.has('n1')).toBe(true)
    })

    it('creates a (no output) child when nodesChanged is absent from response', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({})

      const store = makeStore({ nodes: { n1: { id: 'n1' } }, root: 'n1' })
      await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      const children = store.getState().nodes['n1'].children ?? []
      expect(children).toHaveLength(1)
      expect(store.getState().nodes[children[0]].title).toBe('(no output)')
    })

    it('marks store dirty and persists after creating the (no output) node', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })

      const store = makeStore({ nodes: { n1: { id: 'n1' } }, root: 'n1', isDirty: false })
      const persister = makePersister()
      await makeExecute(store, persister)({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      expect(store.getState().isDirty).toBe(true)
      expect(persister.flush).toHaveBeenCalled()
    })

    it('returns true when backend returns empty nodesChanged', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })

      const store = makeStore({ nodes: { n1: { id: 'n1' } }, root: 'n1' })
      const result = await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      expect(result).toBe(true)
    })
  })

  describe('error child auto-selection on API failure', () => {
    it('auto-selects the error child without clearing checked state when the API call fails', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('boom'))

      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], checked: true } },
        root: 'n1',
        selectedIds: new Set(['n1']),
      })
      await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      const children = store.getState().nodes['n1'].children ?? []
      expect(children).toHaveLength(1)
      expect(store.getState().selectedId).toBe(children[0])
      expect(store.getState().selectedIds.size).toBe(0)
      expect(store.getState().nodes.n1.checked).toBe(true)
    })

    it('does not auto-select when execution is aborted (no error child created)', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))

      const store = makeStore({ nodes: N1, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().nodes['n1'].children).toBeUndefined()
      expect(store.getState().selectedId).toBeUndefined()
    })

    it('does not create an error child or override selection when response was already received', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: N1.n1 } })
      vi.mocked(mergeWorkflowChanges).mockImplementationOnce(() => {
        throw new Error('merge failed after response')
      })

      const store = makeStore({ nodes: { n1: { id: 'n1', children: [] } }, root: 'n1' })
      await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      expect(store.getState().nodes['n1'].children).toEqual([])
    })
  })

  describe('fallback selection for control-flow commands', () => {
    it('selects first new grandchild when executed node has no new direct children', async () => {
      const existingNodes = {
        n1: { id: 'n1', children: ['n2'] } as NodeData,
        n2: { id: 'n2', parent: 'n1', children: [] } as NodeData,
      } as WorkflowStoreState['nodes']
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { output1: { id: 'output1', parent: 'n2' } as NodeData },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: existingNodes.n1,
          n2: { ...existingNodes.n2, children: ['output1'] } as NodeData,
          output1: { id: 'output1', parent: 'n2' } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: existingNodes, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().selectedId).toBe('output1')
    })

    it('does not use grandchild fallback when executed node produced direct new children', async () => {
      const existingNodes = {
        n1: { id: 'n1', children: ['n2'] } as NodeData,
        n2: { id: 'n2', parent: 'n1', children: [] } as NodeData,
      } as WorkflowStoreState['nodes']
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: {
          directChild: { id: 'directChild', parent: 'n1' } as NodeData,
          grandchild: { id: 'grandchild', parent: 'n2' } as NodeData,
        },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: { ...existingNodes.n1, children: ['n2', 'directChild'] } as NodeData,
          n2: { ...existingNodes.n2, children: ['grandchild'] } as NodeData,
          directChild: { id: 'directChild', parent: 'n1' } as NodeData,
          grandchild: { id: 'grandchild', parent: 'n2' } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: existingNodes, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().selectedId).toBe('directChild')
    })

    it('does not select new node whose parent is a sibling of the executed node', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { sibling_child: { id: 'sibling_child', parent: 'n2' } as NodeData },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: N2.n1,
          n2: N2.n2,
          sibling_child: { id: 'sibling_child', parent: 'n2' } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N2, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().selectedId).toBeUndefined()
    })

    it('selects the first direct child when multiple direct children and grandchildren are produced', async () => {
      const existingNodes = {
        n1: { id: 'n1', children: ['n2'] } as NodeData,
        n2: { id: 'n2', parent: 'n1', children: [] } as NodeData,
      } as WorkflowStoreState['nodes']
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: {
          child1: { id: 'child1', parent: 'n1' } as NodeData,
          child2: { id: 'child2', parent: 'n1' } as NodeData,
          grandchild: { id: 'grandchild', parent: 'n2' } as NodeData,
        },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: { ...existingNodes.n1, children: ['n2', 'child1', 'child2'] } as NodeData,
          n2: { ...existingNodes.n2, children: ['grandchild'] } as NodeData,
          child1: { id: 'child1', parent: 'n1' } as NodeData,
          child2: { id: 'child2', parent: 'n1' } as NodeData,
          grandchild: { id: 'grandchild', parent: 'n2' } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: existingNodes, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      const selected = store.getState().selectedId
      expect(['child1', 'child2']).toContain(selected)
    })
  })

  describe('fan-out animation semantics', () => {
    const foreachNode = { id: 'foreach', parent: 'chat', title: 'Fan out', command: '/foreach /chat @@' } as NodeData
    const existingFanOutNodes = {
      root: { id: 'root', children: ['chat'] } as NodeData,
      chat: { id: 'chat', parent: 'root', children: ['foreach', 'leaf1', 'leaf2'] } as NodeData,
      foreach: foreachNode,
      leaf1: { id: 'leaf1', parent: 'chat', title: 'One', children: [] } as NodeData,
      leaf2: { id: 'leaf2', parent: 'chat', title: 'Two', children: [] } as NodeData,
    }
    const foreachNodesChanged = {
      leaf1: { ...existingFanOutNodes.leaf1, command: '/chat One', children: ['result1'] } as NodeData,
      leaf2: { ...existingFanOutNodes.leaf2, command: '/chat Two', children: ['result2'] } as NodeData,
      result1: { id: 'result1', parent: 'leaf1', title: 'One result' } as NodeData,
      result2: { id: 'result2', parent: 'leaf2', title: 'Two result' } as NodeData,
    }
    const foreachMerged = {
      nodes: {
        ...existingFanOutNodes,
        ...foreachNodesChanged,
      },
      edges: {},
      root: 'root',
      share: { access: [] },
    }

    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('schedules spark for existing populated leaves changed by backend /foreach execution', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: foreachNodesChanged })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce(foreachMerged)

      const store = makeStore({ nodes: existingFanOutNodes, root: 'root', expandedIds: new Set(['chat']) })
      const execute = makeExecute(store, makePersister())

      await execute(foreachNode, 'foreach')

      expect(scheduleTreeAnimation).toHaveBeenCalledTimes(1)
      expect(scheduleTreeAnimation).toHaveBeenCalledWith(
        ['leaf1', 'leaf2'],
        expect.objectContaining({ leaf1: expect.any(Number), leaf2: expect.any(Number) }),
      )
      // Pre-existing leaves reveal their results on the spark but keep their command presentation:
      // only targets newly generated by this execution stand in as clipboard until the spark arrives.
      expect(store.getState().pendingFanOutTargetIds.has('leaf1')).toBe(false)
      expect(store.getState().pendingFanOutTargetIds.has('leaf2')).toBe(false)
    })

    it('reconstructs fan-out when a parent command triggers its /foreach post-processor', async () => {
      const parentCommand = {
        id: 'chat',
        parent: 'root',
        title: 'Prepare topics',
        command: '/chat prepare topics',
        children: ['foreach'],
      } as NodeData
      const before = {
        root: { id: 'root', children: ['chat'] } as NodeData,
        chat: parentCommand,
        foreach: { id: 'foreach', parent: 'chat', command: '/foreach /chat @@', children: [] } as NodeData,
      }
      const changes = {
        generated: {
          id: 'generated',
          parent: 'chat',
          title: 'Generated topic',
          command: '/chat Generated topic',
          children: ['generated-result'],
        } as NodeData,
        'generated-result': { id: 'generated-result', parent: 'generated', title: 'Generated result' } as NodeData,
      }
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: changes })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          ...before,
          chat: { ...parentCommand, children: ['foreach', 'generated'] },
          ...changes,
        },
        edges: {},
        root: 'root',
        share: { access: [] },
      })

      const store = makeStore({ nodes: before, root: 'root', expandedIds: new Set(['chat']) })
      await makeExecute(store, makePersister())(parentCommand, 'chat')

      expect(scheduleTreeAnimation).toHaveBeenCalledWith(
        ['generated'],
        expect.objectContaining({ generated: expect.any(Number) }),
      )
      expect(store.getState().nodes.generated?.collapsed).toBe(true)
      expect(store.getState().expandedIds.has('generated')).toBe(false)
      // A newly generated target does stand in as clipboard until its spark arrives.
      expect(store.getState().pendingFanOutTargetIds.has('generated')).toBe(true)

      vi.runAllTimers()

      expect(store.getState().nodes.generated?.collapsed).toBe(false)
      expect(store.getState().expandedIds.has('generated')).toBe(true)
    })

    it('reveals an arbitrary-depth generated path before animating its populated leaf', async () => {
      const parentCommand = {
        id: 'chat',
        parent: 'root',
        command: '/chat prepare hierarchy',
        children: ['foreach'],
      } as NodeData
      const before = {
        root: { id: 'root', children: ['chat'] } as NodeData,
        chat: parentCommand,
        foreach: { id: 'foreach', parent: 'chat', command: '/foreach /chat @@', children: [] } as NodeData,
      }
      const changes = {
        branch: { id: 'branch', parent: 'chat', title: 'Branch', children: ['nested'], collapsed: true } as NodeData,
        nested: { id: 'nested', parent: 'branch', title: 'Nested', children: ['leaf'], collapsed: true } as NodeData,
        leaf: {
          id: 'leaf',
          parent: 'nested',
          title: 'Leaf',
          command: '/chat Leaf',
          children: ['leaf-result'],
        } as NodeData,
        'leaf-result': { id: 'leaf-result', parent: 'leaf', title: 'Leaf result' } as NodeData,
      }
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: changes })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          ...before,
          chat: { ...parentCommand, children: ['foreach', 'branch'] },
          ...changes,
        },
        edges: {},
        root: 'root',
        share: { access: [] },
      })

      const store = makeStore({ nodes: before, root: 'root', expandedIds: new Set(['chat']) })
      await makeExecute(store, makePersister())(parentCommand, 'chat')

      expect(store.getState().nodes.branch?.collapsed).toBe(false)
      expect(store.getState().nodes.nested?.collapsed).toBe(false)
      expect(store.getState().expandedIds.has('branch')).toBe(true)
      expect(store.getState().expandedIds.has('nested')).toBe(true)
      expect(store.getState().nodes.leaf?.collapsed).toBe(true)
      expect(store.getState().expandedIds.has('leaf')).toBe(false)
      expect(scheduleTreeAnimation).toHaveBeenCalledWith(
        ['leaf'],
        expect.objectContaining({ leaf: expect.any(Number) }),
      )
    })

    it('does not schedule a fan-out spark for ordinary /execute', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1', parent: 'n1', command: '/chat hi', children: [] } as NodeData },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: {
          n1: { id: 'n1', children: ['child1'] } as NodeData,
          child1: { id: 'child1', parent: 'n1', command: '/chat hi', children: [] } as NodeData,
        },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'chat')

      expect(scheduleTreeAnimation).not.toHaveBeenCalled()
    })

    it('does not infer fan-out from a nested command result without a /foreach post-processor', async () => {
      const chatNode = { id: 'chat', parent: 'root', command: '/chat work', children: ['worker'] } as NodeData
      const before = {
        root: { id: 'root', children: ['chat'] } as NodeData,
        chat: chatNode,
        worker: { id: 'worker', parent: 'chat', command: '/chat nested', children: [] } as NodeData,
      }
      const changes = {
        worker: { ...before.worker, children: ['worker-result'] } as NodeData,
        'worker-result': { id: 'worker-result', parent: 'worker', title: 'Result' } as NodeData,
      }
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: changes })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { ...before, ...changes },
        edges: {},
        root: 'root',
        share: { access: [] },
      })

      const store = makeStore({ nodes: before, root: 'root', expandedIds: new Set(['chat']) })
      await makeExecute(store, makePersister())(chatNode, 'chat')

      expect(scheduleTreeAnimation).not.toHaveBeenCalled()
    })

    it('keeps results hidden through every delayed spark, then reveals and clears pending animation state', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: foreachNodesChanged })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce(foreachMerged)

      const store = makeStore({
        nodes: existingFanOutNodes,
        root: 'root',
        expandedIds: new Set(['chat', 'leaf1', 'leaf2']),
      })
      const persister = makePersister()
      const execute = makeExecute(store, persister)

      await execute(foreachNode, 'foreach')

      expect(store.getState().nodes['leaf1']?.collapsed).toBe(true)
      expect(store.getState().nodes['leaf2']?.collapsed).toBe(true)
      expect(store.getState().expandedIds.has('leaf1')).toBe(false)
      expect(store.getState().expandedIds.has('leaf2')).toBe(false)
      expect(persister.schedule).not.toHaveBeenCalled()

      vi.advanceTimersByTime(SPARK_DURATION_MS)

      expect(store.getState().nodes['leaf1']?.collapsed).toBe(true)
      expect(store.getState().nodes['leaf2']?.collapsed).toBe(true)

      vi.runAllTimers()

      expect(store.getState().nodes['leaf1']?.collapsed).toBe(false)
      expect(store.getState().nodes['leaf2']?.collapsed).toBe(false)
      expect(store.getState().expandedIds.has('leaf1')).toBe(true)
      expect(store.getState().expandedIds.has('leaf2')).toBe(true)
      expect(clearTreeAnimation).toHaveBeenCalledTimes(2)
      expect(clearTreeAnimation).toHaveBeenCalledWith('leaf1')
      expect(clearTreeAnimation).toHaveBeenCalledWith('leaf2')
      expect(persister.schedule).toHaveBeenCalledTimes(1)
    })

    it('reveals a nested target path before animation while keeping its result hidden until completion', async () => {
      const nestedNodes = {
        root: { id: 'root', children: ['chat'] } as NodeData,
        chat: { id: 'chat', parent: 'root', children: ['foreach', 'branch'] } as NodeData,
        foreach: foreachNode,
        branch: { id: 'branch', parent: 'chat', title: 'Branch', children: ['nested'], collapsed: true } as NodeData,
        nested: { id: 'nested', parent: 'branch', title: 'Nested leaf', children: [] } as NodeData,
      }
      const nestedChanges = {
        nested: { ...nestedNodes.nested, command: '/chat Nested leaf', children: ['nested-result'] } as NodeData,
        'nested-result': { id: 'nested-result', parent: 'nested', title: 'Nested result' } as NodeData,
      }
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: nestedChanges })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { ...nestedNodes, ...nestedChanges },
        edges: {},
        root: 'root',
        share: { access: [] },
      })

      const store = makeStore({ nodes: nestedNodes, root: 'root', expandedIds: new Set(['chat']) })
      const execute = makeExecute(store, makePersister())

      await execute(foreachNode, 'foreach')

      expect(store.getState().nodes.branch?.collapsed).toBe(false)
      expect(store.getState().expandedIds.has('branch')).toBe(true)
      expect(store.getState().nodes.nested?.collapsed).toBe(true)
      expect(store.getState().expandedIds.has('nested')).toBe(false)
      expect(scheduleTreeAnimation).toHaveBeenCalledWith(
        ['nested'],
        expect.objectContaining({ nested: expect.any(Number) }),
      )

      vi.runAllTimers()

      expect(store.getState().nodes.nested?.collapsed).toBe(false)
      expect(store.getState().expandedIds.has('nested')).toBe(true)
    })
  })
})
