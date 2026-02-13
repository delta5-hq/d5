import type { NodeData, NodeId } from '@shared/base-types'

export const resolveSelectionAfterDelete = (
  nodes: Record<NodeId, NodeData>,
  deletedNodeId: NodeId,
): NodeId | undefined => {
  const node = nodes[deletedNodeId]
  if (!node?.parent) return undefined

  const parent = nodes[node.parent]
  if (!parent?.children?.length) return node.parent

  const siblings = parent.children
  const index = siblings.indexOf(deletedNodeId)
  if (index === -1) return node.parent

  const nextSibling = siblings[index + 1]
  if (nextSibling && nextSibling in nodes) return nextSibling

  const prevSibling = siblings[index - 1]
  if (prevSibling && prevSibling in nodes) return prevSibling

  return node.parent
}
