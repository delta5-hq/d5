import type { NodeData, NodeId } from '@shared/base-types'

export function applyCheckedSelection(
  nodes: Record<NodeId, NodeData>,
  selectedIds: Readonly<Set<NodeId>>,
): { nodes: Record<NodeId, NodeData>; changedIds: NodeId[] } {
  let nextNodes = nodes
  const changedIds: NodeId[] = []

  for (const [nodeId, node] of Object.entries(nodes)) {
    const checked = selectedIds.has(nodeId)
    if (Boolean(node.checked) === checked) continue
    if (nextNodes === nodes) nextNodes = { ...nodes }
    nextNodes[nodeId] = { ...node, checked }
    changedIds.push(nodeId)
  }

  return { nodes: nextNodes, changedIds }
}
