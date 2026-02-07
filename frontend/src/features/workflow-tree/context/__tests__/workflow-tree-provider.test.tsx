import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { WorkflowTreeProvider, useWorkflowTreeData } from '../workflow-tree-provider'
import * as workflowAPI from '@entities/workflow/api'
import type { ReactNode } from 'react'

vi.mock('@entities/workflow/api', () => ({
  useWorkflow: vi.fn(),
}))

const createWrapper = (workflowId: string) => {
  return ({ children }: { children: ReactNode }) => (
    <WorkflowTreeProvider workflowId={workflowId}>{children}</WorkflowTreeProvider>
  )
}

describe('WorkflowTreeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('context provision', () => {
    it('provides workflow data from useWorkflow hook', () => {
      const mockWorkflow: workflowAPI.WorkflowResponse = {
        _id: 'wf-123',
        workflowId: 'workflow-123',
        userId: 'user-1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        nodes: { 'node-1': { id: 'node-1', title: 'Test Node' } },
        edges: { 'edge-1': { id: 'edge-1', start: 'node-1', end: 'node-2' } },
        root: 'node-1',
        share: { access: [] },
      }

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: mockWorkflow,
        nodes: mockWorkflow.nodes,
        root: mockWorkflow.root,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.workflow).toEqual(mockWorkflow)
      expect(result.current.nodes).toEqual(mockWorkflow.nodes)
      expect(result.current.edges).toEqual(mockWorkflow.edges)
      expect(result.current.root).toBe('node-1')
    })

    it('provides all WorkflowResponse fields through workflow property', () => {
      const mockWorkflow: workflowAPI.WorkflowResponse = {
        _id: 'wf-123',
        workflowId: 'workflow-456',
        userId: 'user-789',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        title: 'My Workflow',
        nodes: {},
        edges: {},
        root: 'root',
        share: { access: [] },
      }

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: mockWorkflow,
        nodes: {},
        root: 'root',
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-456'),
      })

      expect(result.current.workflow?.workflowId).toBe('workflow-456')
      expect(result.current.workflow?._id).toBe('wf-123')
      expect(result.current.workflow?.userId).toBe('user-789')
      expect(result.current.workflow?.createdAt).toBe('2024-01-01T00:00:00Z')
      expect(result.current.workflow?.updatedAt).toBe('2024-01-02T00:00:00Z')
      expect(result.current.workflow?.title).toBe('My Workflow')
    })

    it('provides loading state', () => {
      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: undefined,
        root: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.workflow).toBeUndefined()
    })

    it('provides error state', () => {
      const mockError = new Error('Failed to load workflow')

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: undefined,
        root: undefined,
        isLoading: false,
        error: mockError,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.error).toBe(mockError)
      expect(result.current.workflow).toBeUndefined()
    })

    it('provides refetch function', () => {
      const mockRefetch = vi.fn()

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: undefined,
        root: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      result.current.refetch()

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('default values for optional fields', () => {
    it('defaults nodes to empty object when undefined', () => {
      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: undefined,
        root: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.nodes).toEqual({})
    })

    it('defaults edges to empty object when workflow undefined', () => {
      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: undefined,
        root: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.edges).toEqual({})
    })

    it('defaults edges to empty object when workflow.edges undefined', () => {
      const mockWorkflow: workflowAPI.WorkflowResponse = {
        _id: 'wf-123',
        workflowId: 'workflow-123',
        userId: 'user-1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        nodes: {},
        root: 'root',
        share: { access: [] },
      }

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: mockWorkflow,
        nodes: {},
        root: 'root',
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.edges).toEqual({})
    })
  })

  describe('hook usage validation', () => {
    it('throws error when used outside provider', () => {
      expect(() => renderHook(() => useWorkflowTreeData())).toThrow(
        'useWorkflowTreeData must be used within WorkflowTreeProvider',
      )
    })
  })

  describe('workflow id propagation', () => {
    it('passes workflowId to useWorkflow hook', () => {
      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: undefined,
        root: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-xyz'),
      })

      expect(workflowAPI.useWorkflow).toHaveBeenCalledWith('workflow-xyz')
    })
  })

  describe('workflow data updates', () => {
    it('updates context when workflow data changes', async () => {
      const mockRefetch = vi.fn()
      const initialWorkflow: workflowAPI.WorkflowResponse = {
        _id: 'wf-123',
        workflowId: 'workflow-123',
        userId: 'user-1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        nodes: { 'node-1': { id: 'node-1', title: 'Initial' } },
        edges: {},
        root: 'node-1',
        share: { access: [] },
      }

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: initialWorkflow,
        nodes: initialWorkflow.nodes,
        root: initialWorkflow.root,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      })

      const { result, rerender } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.nodes['node-1'].title).toBe('Initial')

      const updatedWorkflow: workflowAPI.WorkflowResponse = {
        ...initialWorkflow,
        nodes: { 'node-1': { id: 'node-1', title: 'Updated' } },
        updatedAt: '2024-01-03',
      }

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: updatedWorkflow,
        nodes: updatedWorkflow.nodes,
        root: updatedWorkflow.root,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      })

      rerender()

      await waitFor(() => {
        expect(result.current.nodes['node-1'].title).toBe('Updated')
      })
    })
  })

  describe('edge cases', () => {
    it('handles workflow with no nodes', () => {
      const mockWorkflow: workflowAPI.WorkflowResponse = {
        _id: 'wf-123',
        workflowId: 'workflow-123',
        userId: 'user-1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        nodes: {},
        edges: {},
        root: 'root',
        share: { access: [] },
      }

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: mockWorkflow,
        nodes: {},
        root: 'root',
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.nodes).toEqual({})
      expect(Object.keys(result.current.nodes).length).toBe(0)
    })

    it('handles workflow with no edges', () => {
      const mockWorkflow: workflowAPI.WorkflowResponse = {
        _id: 'wf-123',
        workflowId: 'workflow-123',
        userId: 'user-1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        nodes: { 'node-1': { id: 'node-1', title: 'Node' } },
        root: 'node-1',
        share: { access: [] },
      }

      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: mockWorkflow,
        nodes: mockWorkflow.nodes,
        root: 'node-1',
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.edges).toEqual({})
    })

    it('handles undefined root', () => {
      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: {},
        root: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.root).toBeUndefined()
    })

    it('handles null error', () => {
      vi.mocked(workflowAPI.useWorkflow).mockReturnValue({
        workflow: undefined,
        nodes: undefined,
        root: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useWorkflowTreeData(), {
        wrapper: createWrapper('workflow-123'),
      })

      expect(result.current.error).toBeNull()
    })
  })
})
