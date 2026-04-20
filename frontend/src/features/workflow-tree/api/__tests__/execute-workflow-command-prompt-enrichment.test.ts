import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeWorkflowCommand } from '../execute-workflow-command'
import type { NodeData } from '@shared/base-types'

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

import { apiFetch } from '@shared/lib/base-api'

const mockApiFetch = vi.mocked(apiFetch)

describe('executeWorkflowCommand - parent enrichment from workflowNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('enrichment behavior', () => {
    it('includes parent in nodesChanged when children reference it', async () => {
      const parent: NodeData = {
        id: 'parent',
        prompts: ['c1', 'c2'],
        children: ['c1', 'c2'],
      }

      mockApiFetch.mockResolvedValueOnce({
        nodesChanged: [
          { id: 'c1', parent: 'parent' },
          { id: 'c2', parent: 'parent' },
        ],
        workflowNodes: {
          parent,
          c1: { id: 'c1', parent: 'parent' },
          c2: { id: 'c2', parent: 'parent' },
        },
      })

      const result = await executeWorkflowCommand({
        queryType: 'chat',
        cell: { id: 'test' },
        workflowNodes: {},
      })

      expect(result.nodesChanged?.parent).toEqual(parent)
      expect(result.nodesChanged?.c1).toBeDefined()
      expect(result.nodesChanged?.c2).toBeDefined()
    })

    it('prefers nodesChanged version when parent present in both', async () => {
      mockApiFetch.mockResolvedValueOnce({
        nodesChanged: {
          parent: { id: 'parent', prompts: ['new'] },
          new: { id: 'new', parent: 'parent' },
        },
        workflowNodes: {
          parent: { id: 'parent', prompts: ['old'] },
          new: { id: 'new', parent: 'parent' },
        },
      })

      const result = await executeWorkflowCommand({
        queryType: 'chat',
        cell: { id: 'test' },
        workflowNodes: {},
      })

      expect(result.nodesChanged?.parent.prompts).toEqual(['new'])
    })
  })

  describe('edge cases', () => {
    it('handles missing workflowNodes field', async () => {
      mockApiFetch.mockResolvedValueOnce({
        nodesChanged: { child: { id: 'child', parent: 'parent' } },
      })

      const result = await executeWorkflowCommand({
        queryType: 'chat',
        cell: { id: 'test' },
        workflowNodes: {},
      })

      expect(result.nodesChanged).toEqual({ child: { id: 'child', parent: 'parent' } })
    })

    it('handles empty nodesChanged', async () => {
      mockApiFetch.mockResolvedValueOnce({
        nodesChanged: [],
        workflowNodes: { parent: { id: 'parent' } },
      })

      const result = await executeWorkflowCommand({
        queryType: 'chat',
        cell: { id: 'test' },
        workflowNodes: {},
      })

      expect(result.nodesChanged).toEqual({})
    })
  })

  describe('field preservation', () => {
    it('preserves all parent fields during enrichment', async () => {
      const fullParent: NodeData = {
        id: 'parent',
        title: 'Title',
        command: '/instruct test',
        prompts: ['child'],
        children: ['child'],
        color: '#ff0000',
        scale: 1.5,
        tags: ['tag1'],
      }

      mockApiFetch.mockResolvedValueOnce({
        nodesChanged: [{ id: 'child', parent: 'parent' }],
        workflowNodes: {
          parent: fullParent,
          child: { id: 'child', parent: 'parent' },
        },
      })

      const result = await executeWorkflowCommand({
        queryType: 'chat',
        cell: { id: 'test' },
        workflowNodes: {},
      })

      expect(result.nodesChanged?.parent).toEqual(fullParent)
    })
  })
})
