import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useExecuteFromTree } from './use-execute-from-tree'
import * as executeAPI from '../api/execute-workflow-command'
import * as workflowMutationAPI from '@entities/workflow/api'
import type { NodeData, WorkflowContentData } from '@shared/base-types'

vi.mock('../api/execute-workflow-command')
vi.mock('@entities/workflow/api', () => ({
  useWorkflowMutation: vi.fn(),
}))

const mockWorkflowData: WorkflowContentData = {
  nodes: {
    node1: { id: 'node1', title: 'Node 1', command: 'test command' },
    node2: { id: 'node2', title: 'Node 2' },
  },
  edges: {},
  root: 'node1',
  share: { access: [] },
}

describe('useExecuteFromTree - Execute Flow', () => {
  let mockUpdateWorkflow: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateWorkflow = vi.fn().mockResolvedValue({})
    vi.mocked(workflowMutationAPI.useWorkflowMutation).mockReturnValue({
      updateWorkflow: mockUpdateWorkflow as any,
      isUpdating: false,
      updateError: null,
    })
  })

  it('executes node command and persists result', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockResolvedValue({
      nodesChanged: {
        node1: { id: 'node1', title: 'Node 1 - Executed' },
      },
    })

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }
    await result.current.executeNode(node, 'chat')

    await waitFor(() => {
      expect(executeAPI.executeWorkflowCommand).toHaveBeenCalledWith({
        queryType: 'chat',
        cell: node,
        workflowNodes: mockWorkflowData.nodes,
        workflowEdges: mockWorkflowData.edges,
        workflowId: 'workflow1',
      })
    })

    await waitFor(() => {
      expect(mockUpdateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.objectContaining({
            node1: expect.objectContaining({
              title: 'Node 1 - Executed',
            }),
          }),
        }),
      )
    })
  })

  it('sets isExecuting during execution', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve({ nodesChanged: {} }), 100)
        }),
    )

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    expect(result.current.isExecuting).toBe(false)

    const node: NodeData = { id: 'node1', command: 'test' }
    const executePromise = result.current.executeNode(node, 'chat')

    await waitFor(() => {
      expect(result.current.isExecuting).toBe(true)
    })

    await executePromise

    await waitFor(() => {
      expect(result.current.isExecuting).toBe(false)
    })
  })

  it('calls onSuccess callback after successful execution', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockResolvedValue({
      nodesChanged: {},
    })

    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
        onSuccess,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }
    await result.current.executeNode(node, 'chat')

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('resets isExecuting after error', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockRejectedValue(new Error('Execution failed'))

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }

    await expect(result.current.executeNode(node, 'chat')).rejects.toThrow('Execution failed')

    await waitFor(() => {
      expect(result.current.isExecuting).toBe(false)
    })
  })
})

describe('useExecuteFromTree - Edge Cases', () => {
  let mockUpdateWorkflow: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateWorkflow = vi.fn().mockResolvedValue({})
    vi.mocked(workflowMutationAPI.useWorkflowMutation).mockReturnValue({
      updateWorkflow: mockUpdateWorkflow as any,
      isUpdating: false,
      updateError: null,
    })
  })

  it('throws error when node has no command and queryType is not chat', async () => {
    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node: NodeData = { id: 'node1' }

    await expect(result.current.executeNode(node, 'web')).rejects.toThrow('Node has no command to execute')
  })

  it('allows execution when node has no command but queryType is chat', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockResolvedValue({
      nodesChanged: {},
    })

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node: NodeData = { id: 'node1' }

    await expect(result.current.executeNode(node, 'chat')).resolves.not.toThrow()
  })

  it('handles empty nodesChanged response', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockResolvedValue({})

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }
    await result.current.executeNode(node, 'chat')

    await waitFor(() => {
      expect(mockUpdateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: mockWorkflowData.nodes,
        }),
      )
    })
  })

  it('merges multiple node changes', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockResolvedValue({
      nodesChanged: {
        node1: { id: 'node1', title: 'Updated 1' },
        node2: { id: 'node2', title: 'Updated 2' },
        node3: { id: 'node3', title: 'New Node' },
      },
    })

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }
    await result.current.executeNode(node, 'chat')

    await waitFor(() => {
      expect(mockUpdateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.objectContaining({
            node1: expect.objectContaining({ title: 'Updated 1' }),
            node2: expect.objectContaining({ title: 'Updated 2' }),
            node3: expect.objectContaining({ title: 'New Node' }),
          }),
        }),
      )
    })
  })

  it('preserves root when merging', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockResolvedValue({
      nodesChanged: {
        node1: { id: 'node1', title: 'Updated' },
      },
    })

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }
    await result.current.executeNode(node, 'chat')

    await waitFor(() => {
      expect(mockUpdateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          root: 'node1',
        }),
      )
    })
  })

  it('does not call onSuccess if execution fails', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockRejectedValue(new Error('Failed'))

    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
        onSuccess,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }

    await expect(result.current.executeNode(node, 'chat')).rejects.toThrow()

    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not call onSuccess if persist fails', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand).mockResolvedValue({
      nodesChanged: { node1: { id: 'node1' } },
    })
    mockUpdateWorkflow.mockRejectedValue(new Error('Persist failed'))

    const onSuccess = vi.fn()

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
        onSuccess,
      }),
    )

    const node: NodeData = { id: 'node1', command: 'test' }

    await expect(result.current.executeNode(node, 'chat')).rejects.toThrow('Persist failed')

    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('useExecuteFromTree - Concurrent Execution', () => {
  let mockUpdateWorkflow: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateWorkflow = vi.fn().mockResolvedValue({})
    vi.mocked(workflowMutationAPI.useWorkflowMutation).mockReturnValue({
      updateWorkflow: mockUpdateWorkflow as any,
      isUpdating: false,
      updateError: null,
    })
  })

  it('handles multiple sequential executions', async () => {
    vi.mocked(executeAPI.executeWorkflowCommand)
      .mockResolvedValueOnce({
        nodesChanged: { node1: { id: 'node1', title: 'First' } },
      })
      .mockResolvedValueOnce({
        nodesChanged: { node2: { id: 'node2', title: 'Second' } },
      })

    const { result } = renderHook(() =>
      useExecuteFromTree({
        workflowId: 'workflow1',
        workflowData: mockWorkflowData,
      }),
    )

    const node1: NodeData = { id: 'node1', command: 'test1' }
    await result.current.executeNode(node1, 'chat')

    const node2: NodeData = { id: 'node2', command: 'test2' }
    await result.current.executeNode(node2, 'chat')

    expect(executeAPI.executeWorkflowCommand).toHaveBeenCalledTimes(2)
    expect(mockUpdateWorkflow).toHaveBeenCalledTimes(2)
  })
})
