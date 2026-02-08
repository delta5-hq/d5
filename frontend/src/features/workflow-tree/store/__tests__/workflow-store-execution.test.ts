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

const stubNode = { id: 'n1', title: 'Node 1', children: [] }

describe('bindExecuteAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears selectedId when merged nodes no longer contain selected node', async () => {
    vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n2: { id: 'n2' } } })
    vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
      nodes: { n2: { id: 'n2' } },
      edges: {},
      root: 'n2',
      share: { access: [] },
    })

    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
      root: 'n1',
      selectedId: 'n1',
    })
    const persister = makePersister()
    const executeCommand = bindExecuteAction(store, persister)

    await executeCommand(stubNode, 'query')

    expect(store.getState().selectedId).toBeUndefined()
  })

  it('preserves selectedId when merged nodes still contain selected node', async () => {
    vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: { n1: { id: 'n1', title: 'Updated' } } })
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
    const executeCommand = bindExecuteAction(store, persister)

    await executeCommand(stubNode, 'query')

    expect(store.getState().selectedId).toBe('n1')
  })

  it('leaves selectedId undefined when nothing was selected before execute', async () => {
    vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
    vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
      nodes: { n1: { id: 'n1' } },
      edges: {},
      root: 'n1',
      share: { access: [] },
    })

    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
      root: 'n1',
    })
    const persister = makePersister()
    const executeCommand = bindExecuteAction(store, persister)

    await executeCommand(stubNode, 'query')

    expect(store.getState().selectedId).toBeUndefined()
  })

  it('does not modify selectedId on execution failure', async () => {
    vi.mocked(executeWorkflowCommand).mockRejectedValueOnce(new Error('server error'))

    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
      root: 'n1',
      selectedId: 'n1',
    })
    const persister = makePersister()
    const executeCommand = bindExecuteAction(store, persister)

    await executeCommand(stubNode, 'query')

    expect(store.getState().selectedId).toBe('n1')
  })

  it('sets isExecuting during execution and clears after', async () => {
    let executingDuringCall = false
    vi.mocked(executeWorkflowCommand).mockImplementationOnce(async () => {
      executingDuringCall = store.getState().isExecuting
      return { nodesChanged: {} }
    })
    vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
      nodes: { n1: { id: 'n1' } },
      edges: {},
      root: 'n1',
      share: { access: [] },
    })

    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
      root: 'n1',
    })
    const persister = makePersister()
    const executeCommand = bindExecuteAction(store, persister)

    await executeCommand(stubNode, 'query')

    expect(executingDuringCall).toBe(true)
    expect(store.getState().isExecuting).toBe(false)
  })

  it('flushes dirty state before executing', async () => {
    vi.mocked(executeWorkflowCommand).mockResolvedValueOnce({ nodesChanged: {} })
    vi.mocked(mergeWorkflowNodes).mockReturnValueOnce({
      nodes: { n1: { id: 'n1' } },
      edges: {},
      root: 'n1',
      share: { access: [] },
    })

    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
      root: 'n1',
      isDirty: true,
    })
    const persister = makePersister()
    const executeCommand = bindExecuteAction(store, persister)

    await executeCommand(stubNode, 'query')

    expect(persister.flush).toHaveBeenCalled()
  })

  it('returns false when pre-execution persist fails', async () => {
    const store = makeStore({
      nodes: { n1: { id: 'n1' } } as WorkflowStoreState['nodes'],
      root: 'n1',
      isDirty: true,
    })
    const persister = makePersister()
    vi.mocked(persister.flush).mockResolvedValueOnce(false)
    const executeCommand = bindExecuteAction(store, persister)

    const result = await executeCommand(stubNode, 'query')

    expect(result).toBe(false)
    expect(executeWorkflowCommand).not.toHaveBeenCalled()
  })
})
