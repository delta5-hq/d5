import type { NodeData } from '@shared/base-types'

export function enrichNodesWithParents(
  changedNodes: Record<string, NodeData>,
  completeNodeMap: Record<string, NodeData>,
): Record<string, NodeData> {
  const parentIds = new Set<string>()

  for (const node of Object.values(changedNodes)) {
    if (node.parent && !changedNodes[node.parent] && completeNodeMap[node.parent]) {
      parentIds.add(node.parent)
    }
  }

  if (parentIds.size === 0) {
    return changedNodes
  }

  const enriched: Record<string, NodeData> = { ...changedNodes }
  for (const parentId of parentIds) {
    enriched[parentId] = completeNodeMap[parentId]
  }

  return enriched
}
