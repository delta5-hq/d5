import { apiFetch } from '@shared/lib/base-api'
import type { NodeData, EdgeData } from '@shared/base-types'

export interface ResolvePreviewRequest {
  nodeId: string
  workflowNodes: Record<string, NodeData>
  workflowEdges?: Record<string, EdgeData>
  workflowFiles?: Record<string, unknown>
  workflowId?: string
}

export interface ResolvePreviewResponse {
  resolvedCommand: string
}

export const resolveNodePreview = async (request: ResolvePreviewRequest): Promise<ResolvePreviewResponse> =>
  apiFetch<ResolvePreviewResponse>('/execute/preview', {
    method: 'POST',
    body: JSON.stringify(request),
    headers: { 'Content-Type': 'application/json' },
  })
