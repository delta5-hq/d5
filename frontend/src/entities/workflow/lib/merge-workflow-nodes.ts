import type { WorkflowContentData, NodeData } from '@shared/base-types'

interface NodesChangedResponse {
  nodesChanged?: Record<string, NodeData>
}

export const mergeWorkflowNodes = (
  current: WorkflowContentData,
  changes: NodesChangedResponse,
): WorkflowContentData => {
  if (!changes.nodesChanged) {
    return current
  }

  return {
    ...current,
    nodes: {
      ...current.nodes,
      ...changes.nodesChanged,
    },
  }
}
