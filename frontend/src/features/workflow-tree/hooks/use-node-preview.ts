import { useMemo } from 'react'
import type { NodeData, NodeId, EdgeData, EdgeId } from '@shared/base-types'
import { resolveNodeReferences, makeNodeStore, buildPreviewParams, isCommandlessTextNode } from '@entities/workflow/lib'

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
    // Lazy-split prompt children are a structural projection of the source title.
    // Preview must not append that projection to the same title a second time.
    return resolveNodeReferences(node, store, buildPreviewParams({ nonPromptNode: isCommandlessTextNode(node) }))
  }, [nodeId, nodes, edges])

  return { previewText }
}
