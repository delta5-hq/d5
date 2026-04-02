import { apiFetch } from '@shared/lib/base-api'
import { normalizeToRecord } from '@shared/lib/normalize-to-record'
import { enrichNodesWithParents } from '@entities/workflow/lib'
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
  signal?: AbortSignal
}

interface BackendExecuteResponse {
  nodesChanged?: NodeData[] | Record<string, NodeData>
  edgesChanged?: EdgeData[] | Record<string, EdgeData>
  workflowNodes?: Record<string, NodeData>
  cell?: NodeData
}

interface ExecuteResponse {
  nodesChanged?: Record<string, NodeData>
  edgesChanged?: Record<string, EdgeData>
  cell?: NodeData
}

export const executeWorkflowCommand = async ({ signal, ...request }: ExecuteRequest): Promise<ExecuteResponse> => {
  try {
    const raw = await apiFetch<BackendExecuteResponse>('/execute', {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' },
      signal,
    })

    const normalizedChanges = normalizeToRecord(raw.nodesChanged)
    const completeNodeMap = raw.workflowNodes ?? {}
    const enrichedChanges = enrichNodesWithParents(normalizedChanges ?? {}, completeNodeMap)

    return {
      ...raw,
      nodesChanged: enrichedChanges,
      edgesChanged: normalizeToRecord(raw.edgesChanged),
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    toast.error(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}
