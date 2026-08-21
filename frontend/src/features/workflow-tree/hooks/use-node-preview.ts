import { useMemo } from 'react'
import type { NodeData, NodeId, EdgeData, EdgeId } from '@shared/base-types'
import { resolveNodeReferences, makeNodeStore, buildPreviewParams } from '@entities/workflow/lib'

interface UseNodePreviewParams {
  nodeId: NodeId
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
}

export interface UseNodePreviewResult {
  previewText: string
}

export function useNodePreview({ nodeId, nodes, edges }: UseNodePreviewParams): UseNodePreviewResult {
  const previewText = useMemo(() => {
    const store = makeNodeStore(nodes, edges)
    const node = store.getNode(nodeId)
    if (!node) return ''
    return resolveNodeReferences(node, store, buildPreviewParams())
  }, [nodeId, nodes, edges])

  return { previewText }
}
