import { describe, it, expect } from 'vitest'
import type { WorkflowItem } from '../workflow.types'

describe('WorkflowItem type structure', () => {
  it('enforces workflowId as canonical identifier', () => {
    const validWorkflow: WorkflowItem = {
      workflowId: 'wf-12345',
      userId: 'user-1',
      tags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      __v: 0,
      root: 'root-node',
      title: 'Test Workflow',
    }

    expect(validWorkflow.workflowId).toBeDefined()
    expect(typeof validWorkflow.workflowId).toBe('string')
  })

  it('rejects _id field at type level', () => {
    const workflowBase = {
      workflowId: 'wf-12345',
      userId: 'user-1',
      tags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      __v: 0,
      root: 'root-node',
      title: 'Test Workflow',
    }

    // @ts-expect-error _id field does not exist on WorkflowItem type
    const invalidWorkflow: WorkflowItem = { ...workflowBase, _id: 'should-not-exist' }

    expect(invalidWorkflow).toBeDefined()
  })

  it('supports optional fields with proper typing', () => {
    const minimalWorkflow: WorkflowItem = {
      workflowId: 'wf-minimal',
      userId: 'user-1',
      tags: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      __v: 0,
      root: 'root',
      title: '',
    }

    const fullWorkflow: WorkflowItem = {
      ...minimalWorkflow,
      share: {
        public: { enabled: true, hidden: false, writeable: false },
        access: [],
      },
      category: 'projects',
    }

    expect(minimalWorkflow.share).toBeUndefined()
    expect(fullWorkflow.share).toBeDefined()
    expect(fullWorkflow.category).toBe('projects')
  })
})
