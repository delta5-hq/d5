import { apiFetch } from '@shared/lib/base-api'
import { normalizeToRecord } from '@shared/lib/normalize-to-record'
import type { NodeData, EdgeData } from '@shared/base-types'
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

interface BackendExecuteResponse {
  nodesChanged?: NodeData[] | Record<string, NodeData>
  edgesChanged?: EdgeData[] | Record<string, EdgeData>
  cell?: NodeData
}

interface ExecuteResponse {
  nodesChanged?: Record<string, NodeData>
  edgesChanged?: Record<string, EdgeData>
  cell?: NodeData
}

export const executeWorkflowCommand = async (request: ExecuteRequest): Promise<ExecuteResponse> => {
  try {
    const raw = await apiFetch<BackendExecuteResponse>('/execute', {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return {
      ...raw,
      nodesChanged: normalizeToRecord(raw.nodesChanged),
      edgesChanged: normalizeToRecord(raw.edgesChanged),
    }
  } catch (error) {
    toast.error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}
