import { apiFetch } from '@shared/lib/base-api'
import type { NodeData } from '@shared/base-types'
import { toast } from 'sonner'

interface ExecuteRequest {
  queryType: string
  cell: NodeData
  workflowNodes: Record<string, NodeData>
  workflowEdges?: Record<string, unknown>
  workflowFiles?: Record<string, unknown>
  workflowId?: string
  context?: unknown
  prompt?: string
}

interface ExecuteResponse {
  nodesChanged?: Record<string, NodeData>
  edgesChanged?: Record<string, unknown>
  cell?: NodeData
}

export const executeWorkflowCommand = async (request: ExecuteRequest): Promise<ExecuteResponse> => {
  try {
    const response = await apiFetch<ExecuteResponse>('/execute', {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return response
  } catch (error) {
    toast.error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}
