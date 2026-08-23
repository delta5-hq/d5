import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStore } from '@shared/lib/store'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { bindExecuteAction, type ExecuteActionOptions } from '../workflow-store-execution'
import type { DebouncedPersister } from '../workflow-store-persistence'
import type { EdgeData, NodeData } from '@shared/base-types'

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

vi.mock('../../api/streaming/fork-stream-client', () => ({
  ForkStreamClient: vi.fn().mockImplementation(function () {
    return { connect: vi.fn(), disconnect: vi.fn(), whenReady: vi.fn().mockResolvedValue(undefined) }
  }),
}))

vi.mock('@shared/lib/reliability/elect-params', () => ({
  isValidElectCell: vi.fn().mockReturnValue(false),
}))

import { mergeWorkflowChanges } from '@entities/workflow/lib'
import { executeWorkflowCommand } from '../../api/execute-workflow-command'
import { notifyExecutionStarted, notifyExecutionCompleted, notifyExecutionAborted } from '../execution-genie-bridge'
import { ForkStreamClient } from '../../api/streaming/fork-stream-client'
import { isValidElectCell } from '@shared/lib/reliability/elect-params'
import type { ForkEvent } from '../../api/streaming/fork-event-types'

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

const ZERO_DELAY: ExecuteActionOptions = { minExecutingVisibleMs: 0 }

function makeExecute(store: ReturnType<typeof makeStore>, persister: DebouncedPersister) {
  return bindExecuteAction(store, persister, ZERO_DELAY).executeCommand
}

type ExecuteWorkflowResponse = Awaited<ReturnType<typeof executeWorkflowCommand>>

function expectWorkflowStateReferencesPreserved(
  store: ReturnType<typeof makeStore>,
  stateBefore: WorkflowStoreState,
): void {
  expect(store.getState().nodes).toBe(stateBefore.nodes)
  expect(store.getState().edges).toBe(stateBefore.edges)
  expect(store.getState().root).toBe(stateBefore.root)
  expect(store.getState().expandedIds).toBe(stateBefore.expandedIds)
  expect(store.getState().selectedId).toBe(stateBefore.selectedId)
  expect(store.getState().selectedIds).toBe(stateBefore.selectedIds)
  expect(store.getState().anchorId).toBe(stateBefore.anchorId)
  expect(store.getState().isDirty).toBe(stateBefore.isDirty)
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

  describe('store state immutability on execution failure', () => {
    it('does not mutate workflow nodes or invoke merge when the API rejects with AbortError', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))

      const store = makeStore({ nodes: N1, root: 'n1' })
      const nodesBefore = { ...store.getState().nodes }
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().nodes).toEqual(nodesBefore)
      expect(mergeWorkflowChanges).not.toHaveBeenCalled()
    })

    it.each([
      ['network Error', new Error('network error'), 'Error: network error'],
      ['TypeError', new TypeError('unexpected response'), 'Error: unexpected response'],
      ['non-AbortError DOMException', new DOMException('not allowed', 'NotAllowedError'), 'Error: Unknown error'],
    ])(
      'creates a visible local error node without invoking merge when the API rejects with %s',
      async (_label, error, expectedTitle) => {
        vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(error)

        const store = makeStore({ nodes: N1, root: 'n1' })
        await makeExecute(store, makePersister())(stubNode, 'query')

        const parentChildren = store.getState().nodes['n1']?.children ?? []
        expect(parentChildren).toHaveLength(1)
        const errorNodeId = parentChildren[0]
        expect(store.getState().nodes[errorNodeId]).toMatchObject({ parent: 'n1', title: expectedTitle })
        expect(store.getState().selectedId).toBe(errorNodeId)
        expect(mergeWorkflowChanges).not.toHaveBeenCalled()
      },
    )
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
      const updatedNodes = { n1: { id: 'n1', title: 'Updated' } } as WorkflowStoreState['nodes']
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: updatedNodes })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: updatedNodes,
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

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
        const { executeCommand } = bindExecuteAction(store, makePersister(), ZERO_DELAY)

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
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister(), ZERO_DELAY)

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
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister(), ZERO_DELAY)

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
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister(), ZERO_DELAY)

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
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister(), ZERO_DELAY)

        const first = executeCommand(stubNode, 'query')
        abortExecution('n1')
        resolveFirst({ nodesChanged: {} })
        await first

        mockIdentityExecution(N1)
        const second = await executeCommand(stubNode, 'query')
        expect(second).toBe(true)
      })

      it('is safe to call abortExecution for a node that has never executed', () => {
        const { abortExecution } = bindExecuteAction(makeStore({ nodes: N1, root: 'n1' }), makePersister(), ZERO_DELAY)
        expect(() => abortExecution('unknown-node')).not.toThrow()
      })

      it('is safe to call abortExecution for a node after its execution completed normally', async () => {
        mockIdentityExecution(N1)
        const store = makeStore({ nodes: N1, root: 'n1' })
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister(), ZERO_DELAY)

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

    it('clears selectedIds when auto-selecting a new child', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({
        nodesChanged: { child1: { id: 'child1', parent: 'n1' } },
      })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: { n1: { id: 'n1' }, child1: { id: 'child1', parent: 'n1' } },
        edges: {},
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N1, root: 'n1', selectedIds: new Set(['n1']) })
      const execute = makeExecute(store, makePersister())

      await execute(stubNode, 'query')

      expect(store.getState().selectedId).toBe('child1')
      expect(store.getState().selectedIds.size).toBe(0)
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

  describe('empty successful response handling', () => {
    const emptyChangeResponses: [string, ExecuteWorkflowResponse][] = [
      ['absent change payload', {}],
      ['empty node changes only', { nodesChanged: {} }],
      ['empty edge changes only', { edgesChanged: {} }],
      ['empty node and edge changes', { nodesChanged: {}, edgesChanged: {} }],
    ]

    it.each(emptyChangeResponses)('treats %s as a successful workflow no-op', async (_label, response) => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce(response)

      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [] } },
        edges: { e1: { id: 'e1', start: 'n1', end: 'n1' } as EdgeData },
        root: 'n1',
        expandedIds: new Set<string>(['n1']),
        selectedId: 'n1',
        selectedIds: new Set<string>(['n1']),
        anchorId: 'n1',
        isDirty: false,
      })
      const persister = makePersister()
      const stateBefore = store.getState()

      const result = await makeExecute(store, persister)(stubNode, 'query')

      expect(result).toBe(true)
      expectWorkflowStateReferencesPreserved(store, stateBefore)
      expect(mergeWorkflowChanges).not.toHaveBeenCalled()
      expect(persister.flush).not.toHaveBeenCalled()
    })

    it('keeps the pre-execution flush boundary when an already-dirty workflow gets no changes back', async () => {
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {}, edgesChanged: {} })

      const store = makeStore({ nodes: { n1: { id: 'n1', children: [] } }, root: 'n1', isDirty: true })
      const persister = makePersister()
      const result = await makeExecute(store, persister)({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      expect(result).toBe(true)
      expect(persister.flush).toHaveBeenCalledTimes(1)
      expect(mergeWorkflowChanges).not.toHaveBeenCalled()
    })

    it('merges edge-only successful responses', async () => {
      const edge = { id: 'e1', start: 'n1', end: 'n2' } as EdgeData
      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {}, edgesChanged: { e1: edge } })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
        nodes: N2,
        edges: { e1: edge },
        root: 'n1',
        share: { access: [] },
      })

      const store = makeStore({ nodes: N2, root: 'n1', isDirty: false })
      const persister = makePersister()
      const result = await makeExecute(store, persister)(stubNode, 'query')

      expect(result).toBe(true)
      expect(mergeWorkflowChanges).toHaveBeenCalledWith(expect.any(Object), {
        nodesChanged: {},
        edgesChanged: { e1: edge },
      })
      expect(store.getState().edges).toEqual({ e1: edge })
      expect(store.getState().isDirty).toBe(true)
      expect(persister.flush).toHaveBeenCalledTimes(1)
    })
  })

  describe('error child auto-selection on API failure', () => {
    it('auto-selects the error child node when API call fails', async () => {
      vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('boom'))

      const store = makeStore({ nodes: { n1: { id: 'n1', children: [] } }, root: 'n1' })
      await makeExecute(store, makePersister())({ id: 'n1', title: 'Node 1', children: [] }, 'query')

      const children = store.getState().nodes['n1'].children ?? []
      expect(children).toHaveLength(1)
      expect(store.getState().selectedId).toBe(children[0])
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

  describe('executing indicator minimum visible duration', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    describe('hold on successful completion', () => {
      it('indicator persists until the min window elapses after the API responds', async () => {
        vi.useFakeTimers()

        let resolveApi!: (value: { nodesChanged: Record<string, never> }) => void
        vi.mocked(executeWorkflowCommand).mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveApi = resolve
            }),
        )
        vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
          nodes: N1,
          edges: {},
          root: 'n1',
          share: { access: [] },
        })

        const store = makeStore({ nodes: N1, root: 'n1' })
        const pending = bindExecuteAction(store, makePersister(), { minExecutingVisibleMs: 300 }).executeCommand(
          stubNode,
          'query',
        )

        resolveApi({ nodesChanged: {} })
        await vi.advanceTimersByTimeAsync(150)
        expect(store.getState().executingNodeIds.has('n1')).toBe(true)

        await vi.advanceTimersByTimeAsync(200)
        expect(store.getState().executingNodeIds.has('n1')).toBe(false)

        await pending
      })

      it('indicator clears without extra delay when the API call itself outlasts the min window', async () => {
        vi.useFakeTimers()

        let resolveApi!: (value: { nodesChanged: WorkflowStoreState['nodes'] }) => void
        vi.mocked(executeWorkflowCommand).mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveApi = resolve
            }),
        )
        vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
          nodes: N1,
          edges: {},
          root: 'n1',
          share: { access: [] },
        })

        const store = makeStore({ nodes: N1, root: 'n1' })
        const pending = bindExecuteAction(store, makePersister(), { minExecutingVisibleMs: 300 }).executeCommand(
          stubNode,
          'query',
        )

        await vi.advanceTimersByTimeAsync(500)
        resolveApi({ nodesChanged: {} })

        // The min window (300ms) already elapsed inside the API call; no additional hold needed.
        // Indicator should clear on the next microtask flush, not after another 300ms.
        await vi.advanceTimersByTimeAsync(0)
        expect(store.getState().executingNodeIds.has('n1')).toBe(false)

        await pending
      })

      it('result data is committed to the store before the min window elapses', async () => {
        vi.useFakeTimers()

        let resolveApi!: (value: { nodesChanged: WorkflowStoreState['nodes'] }) => void
        vi.mocked(executeWorkflowCommand).mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveApi = resolve
            }),
        )
        const updatedNodes = { n1: { id: 'n1', title: 'Updated result' } } as WorkflowStoreState['nodes']
        vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
          nodes: updatedNodes,
          edges: {},
          root: 'n1',
          share: { access: [] },
        })

        const store = makeStore({ nodes: N1, root: 'n1' })
        const pending = bindExecuteAction(store, makePersister(), { minExecutingVisibleMs: 300 }).executeCommand(
          stubNode,
          'query',
        )

        resolveApi({ nodesChanged: updatedNodes })
        await vi.advanceTimersByTimeAsync(50)

        // Node data is already visible while the indicator is still up
        expect(store.getState().nodes['n1']?.title).toBe('Updated result')
        expect(store.getState().executingNodeIds.has('n1')).toBe(true)

        await vi.advanceTimersByTimeAsync(300)
        expect(store.getState().executingNodeIds.has('n1')).toBe(false)

        await pending
      })

      it('indicator clears immediately when minExecutingVisibleMs is zero', async () => {
        mockIdentityExecution(N1)

        const store = makeStore({ nodes: N1, root: 'n1' })
        await bindExecuteAction(store, makePersister(), { minExecutingVisibleMs: 0 }).executeCommand(stubNode, 'query')

        expect(store.getState().executingNodeIds.has('n1')).toBe(false)
      })
    })

    describe('hold on non-abort failure', () => {
      it.each([
        ['Error', new Error('network failure')],
        ['TypeError', new TypeError('unexpected condition')],
        ['non-AbortError DOMException', new DOMException('not allowed', 'NotAllowedError')],
      ])('indicator persists for the min window after a %s', async (_label, error) => {
        vi.useFakeTimers()

        vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(error)

        const store = makeStore({ nodes: N1, root: 'n1' })
        const pending = bindExecuteAction(store, makePersister(), { minExecutingVisibleMs: 300 }).executeCommand(
          stubNode,
          'query',
        )

        await vi.advanceTimersByTimeAsync(150)
        expect(store.getState().executingNodeIds.has('n1')).toBe(true)

        await vi.advanceTimersByTimeAsync(200)
        expect(store.getState().executingNodeIds.has('n1')).toBe(false)

        await pending
      })
    })

    describe('abort bypasses hold', () => {
      it('user-initiated abort clears the indicator immediately without holding the min window', async () => {
        vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))

        const store = makeStore({ nodes: N1, root: 'n1' })
        const { executeCommand, abortExecution } = bindExecuteAction(store, makePersister(), {
          minExecutingVisibleMs: 60_000,
        })

        const pending = executeCommand(stubNode, 'query')
        abortExecution('n1')
        await pending

        expect(store.getState().executingNodeIds.has('n1')).toBe(false)
      })

      it('aborting one concurrent execution does not skip the hold window of the other', async () => {
        vi.useFakeTimers()

        let resolveN2!: (value: { nodesChanged: Record<string, never> }) => void
        vi.mocked(executeWorkflowCommand)
          .mockImplementationOnce(() => Promise.reject(new DOMException('aborted', 'AbortError')))
          .mockImplementationOnce(
            () =>
              new Promise(resolve => {
                resolveN2 = resolve
              }),
          )

        const store = makeStore({ nodes: N2, root: 'n1' })
        const { executeCommand } = bindExecuteAction(store, makePersister(), { minExecutingVisibleMs: 300 })

        const p1 = executeCommand(stubNode, 'query')
        const p2 = executeCommand(stubNodeB, 'query')

        // p1 aborts immediately with no hold; settles without timer advancement
        await p1

        expect(store.getState().executingNodeIds.has('n1')).toBe(false)
        expect(store.getState().executingNodeIds.has('n2')).toBe(true)

        vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({
          nodes: N2,
          edges: {},
          root: 'n1',
          share: { access: [] },
        })
        resolveN2({ nodesChanged: {} })

        await vi.advanceTimersByTimeAsync(150)
        expect(store.getState().executingNodeIds.has('n2')).toBe(true)

        await vi.advanceTimersByTimeAsync(200)
        expect(store.getState().executingNodeIds.has('n2')).toBe(false)

        await p2
      })
    })
  })

  describe('fork preview clearing', () => {
    function activateStreaming(): void {
      vi.mocked(isValidElectCell).mockReturnValue(true)
      vi.mocked(ForkStreamClient).mockImplementation(function () {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          whenReady: vi.fn().mockResolvedValue(undefined),
        } as unknown as InstanceType<typeof ForkStreamClient>
      })
    }

    function getStreamCallbacks(invocationIndex = 0): { onForkEvent: (event: ForkEvent) => void } {
      return vi.mocked(ForkStreamClient).mock.calls[invocationIndex][1] as {
        onForkEvent: (event: ForkEvent) => void
      }
    }

    it('clears only the electNodeIds emitted by this execution, preserving sibling execution previews', async () => {
      activateStreaming()
      mockIdentityExecution(N1)

      const siblingEntry = { total: 2, forks: [], winnerForkIndex: null }
      const store = makeStore({ nodes: N1, root: 'n1', forkPreviews: new Map([['rSibling', siblingEntry]]) })
      const done = makeExecute(store, makePersister())(stubNode, 'query')

      getStreamCallbacks().onForkEvent({ type: 'fork_started', electNodeId: 'rOwn', forkIndex: 0, total: 2 })

      await done

      expect(store.getState().forkPreviews.has('rSibling')).toBe(true)
      expect(store.getState().forkPreviews.has('rOwn')).toBe(false)
    })

    it('non-streaming execution leaves forkPreviews entirely untouched', async () => {
      vi.mocked(isValidElectCell).mockReturnValue(false)
      mockIdentityExecution(N1)

      const entry = { total: 1, forks: [], winnerForkIndex: null }
      const store = makeStore({ nodes: N1, root: 'n1', forkPreviews: new Map([['rOther', entry]]) })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().forkPreviews.has('rOther')).toBe(true)
    })

    it('clears all electNodeIds emitted across multiple elect descendants in one execution', async () => {
      activateStreaming()
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const done = makeExecute(store, makePersister())(stubNode, 'query')

      const cb = getStreamCallbacks()
      cb.onForkEvent({ type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 })
      cb.onForkEvent({ type: 'fork_started', electNodeId: 'r2', forkIndex: 0, total: 3 })
      cb.onForkEvent({ type: 'fork_started', electNodeId: 'r3', forkIndex: 0, total: 2 })

      await done

      expect(store.getState().forkPreviews.has('r1')).toBe(false)
      expect(store.getState().forkPreviews.has('r2')).toBe(false)
      expect(store.getState().forkPreviews.has('r3')).toBe(false)
    })

    it('streaming execution with zero fork events emitted clears nothing', async () => {
      activateStreaming()
      mockIdentityExecution(N1)

      const entry = { total: 1, forks: [], winnerForkIndex: null }
      const store = makeStore({ nodes: N1, root: 'n1', forkPreviews: new Map([['rOther', entry]]) })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().forkPreviews.has('rOther')).toBe(true)
    })

    it('does not construct ForkStreamClient when the executing node has no elect command or descendants', async () => {
      vi.mocked(isValidElectCell).mockReturnValue(false)
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(vi.mocked(ForkStreamClient)).not.toHaveBeenCalled()
    })

    it('omits streamSessionId from executeWorkflowCommand when execution is non-streaming', async () => {
      vi.mocked(isValidElectCell).mockReturnValue(false)
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(vi.mocked(executeWorkflowCommand).mock.calls[0][0].streamSessionId).toBeUndefined()
    })

    it('passes streamSessionId to executeWorkflowCommand when streaming is active', async () => {
      activateStreaming()
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      const { streamSessionId } = vi.mocked(executeWorkflowCommand).mock.calls[0][0]
      expect(typeof streamSessionId).toBe('string')
      expect(streamSessionId.length).toBeGreaterThan(0)
    })

    it('awaits stream readiness (whenReady) BEFORE issuing the execute POST — closes the session-registration race that 400s streaming executions', async () => {
      vi.mocked(isValidElectCell).mockReturnValue(true)
      let executeCallsWhenReadyRan = -1
      const whenReady = vi.fn().mockImplementation(async () => {
        // capture how many execute POSTs had fired at the moment the readiness gate ran
        executeCallsWhenReadyRan = vi.mocked(executeWorkflowCommand).mock.calls.length
      })
      vi.mocked(ForkStreamClient).mockImplementation(function () {
        return { connect: vi.fn(), disconnect: vi.fn(), whenReady } as unknown as InstanceType<typeof ForkStreamClient>
      })
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      await makeExecute(store, makePersister())(stubNode, 'query')

      expect(whenReady).toHaveBeenCalledTimes(1)
      // the execute POST must NOT have been issued yet when the readiness gate ran
      expect(executeCallsWhenReadyRan).toBe(0)
    })

    it('applies fork events to forkPreviews immediately while execution is still in flight', async () => {
      activateStreaming()

      let resolveCmd!: (v: { nodesChanged: Record<string, never> }) => void
      const pendingCmd = new Promise<{ nodesChanged: Record<string, never> }>(r => {
        resolveCmd = r
      })
      vi.mocked(executeWorkflowCommand).mockImplementationOnce(() => pendingCmd)
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({ nodes: N1, edges: {}, root: 'n1', share: { access: [] } })

      const store = makeStore({ nodes: N1, root: 'n1' })
      const done = makeExecute(store, makePersister())(stubNode, 'query')

      expect(store.getState().forkPreviews.has('rLive')).toBe(false)
      getStreamCallbacks().onForkEvent({ type: 'fork_started', electNodeId: 'rLive', forkIndex: 0, total: 2 })
      expect(store.getState().forkPreviews.has('rLive')).toBe(true)

      resolveCmd({ nodesChanged: {} })
      await done
    })

    it('deduplicates the same electNodeId received from multiple fork events into a single deletion', async () => {
      activateStreaming()
      mockIdentityExecution(N1)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const done = makeExecute(store, makePersister())(stubNode, 'query')

      const cb = getStreamCallbacks()
      cb.onForkEvent({ type: 'fork_started', electNodeId: 'rSame', forkIndex: 0, total: 2 })
      cb.onForkEvent({ type: 'fork_settled', electNodeId: 'rSame', forkIndex: 0, status: 'ok' })
      cb.onForkEvent({ type: 'fork_started', electNodeId: 'rSame', forkIndex: 1, total: 2 })

      await done

      expect(store.getState().forkPreviews.has('rSame')).toBe(false)
    })

    it('clears previews even when executeWorkflowCommand rejects with a non-abort error', async () => {
      activateStreaming()

      let rejectCmd!: (err: Error) => void
      const pendingCmd = new Promise<{ nodesChanged: Record<string, never> }>((_, r) => {
        rejectCmd = r
      })
      vi.mocked(executeWorkflowCommand).mockImplementationOnce(() => pendingCmd)

      const store = makeStore({ nodes: N1, root: 'n1' })
      const done = makeExecute(store, makePersister())(stubNode, 'query')

      getStreamCallbacks().onForkEvent({ type: 'fork_started', electNodeId: 'rFailed', forkIndex: 0, total: 1 })

      rejectCmd(new Error('server error'))
      const result = await done

      expect(result).toBe(false)
      expect(store.getState().forkPreviews.has('rFailed')).toBe(false)
    })

    it('two concurrent streaming executions each clear only their own electNodeIds', async () => {
      activateStreaming()

      vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({ nodes: N2, edges: {}, root: 'n1', share: { access: [] } })

      let resolveB!: (v: { nodesChanged: Record<string, never> }) => void
      const pendingB = new Promise<{ nodesChanged: Record<string, never> }>(r => {
        resolveB = r
      })
      vi.mocked(executeWorkflowCommand).mockImplementationOnce(() => pendingB)
      vi.mocked(mergeWorkflowChanges).mockReturnValueOnce({ nodes: N2, edges: {}, root: 'n1', share: { access: [] } })

      const store = makeStore({ nodes: N2, root: 'n1' })
      const execute = makeExecute(store, makePersister())
      const doneA = execute(stubNode, 'query')
      const doneB = execute(stubNodeB, 'query')

      getStreamCallbacks(0).onForkEvent({ type: 'fork_started', electNodeId: 'rA', forkIndex: 0, total: 1 })
      getStreamCallbacks(1).onForkEvent({ type: 'fork_started', electNodeId: 'rB', forkIndex: 0, total: 1 })

      expect(store.getState().forkPreviews.has('rA')).toBe(true)
      expect(store.getState().forkPreviews.has('rB')).toBe(true)

      await doneA
      expect(store.getState().forkPreviews.has('rA')).toBe(false)
      expect(store.getState().forkPreviews.has('rB')).toBe(true)

      resolveB({ nodesChanged: {} })
      await doneB
      expect(store.getState().forkPreviews.has('rB')).toBe(false)
    })
  })
})
