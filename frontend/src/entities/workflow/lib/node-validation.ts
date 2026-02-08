import type { NodeData, NodeId } from '@shared/base-types'

export const isValidNodeData = (node: unknown): node is Partial<NodeData> => {
  if (node === null || typeof node !== 'object') return false
  const n = node as Record<string, unknown>
  if (n.id !== undefined && typeof n.id !== 'string') return false
  if (n.title !== undefined && typeof n.title !== 'string') return false
  if (n.parent !== undefined && typeof n.parent !== 'string') return false
  if (n.command !== undefined && typeof n.command !== 'string') return false
  if (n.children !== undefined) {
    if (!Array.isArray(n.children)) return false
    if (!n.children.every(child => typeof child === 'string')) return false
  }
  return true
}

export const isDescendantOf = (
  nodes: Record<NodeId, NodeData>,
  nodeId: NodeId,
  potentialAncestorId: NodeId,
): boolean => {
  if (nodeId === potentialAncestorId) return false

  let currentId: NodeId | undefined = nodes[nodeId]?.parent
  while (currentId) {
    if (currentId === potentialAncestorId) return true
    currentId = nodes[currentId]?.parent
  }
  return false
}

export const getDescendantIds = (nodes: Record<NodeId, NodeData>, nodeId: NodeId): NodeId[] => {
  const node = nodes[nodeId]
  if (!node?.children?.length) return []

  const descendants: NodeId[] = []
  const stack = [...node.children]

  while (stack.length > 0) {
    const childId = stack.pop()!
    descendants.push(childId)
    const childNode = nodes[childId]
    if (childNode?.children?.length) {
      stack.push(...childNode.children)
    }
  }

  return descendants
}

export const getAncestorIds = (nodes: Record<NodeId, NodeData>, nodeId: NodeId): NodeId[] => {
  const ancestors: NodeId[] = []
  let currentId: NodeId | undefined = nodes[nodeId]?.parent

  while (currentId) {
    ancestors.push(currentId)
    currentId = nodes[currentId]?.parent
  }

  return ancestors
}

export const findRootId = (nodes: Record<NodeId, NodeData>): NodeId | undefined => {
  for (const [id, node] of Object.entries(nodes)) {
    if (!node.parent) return id
  }
  return undefined
}

export const hasCircularReference = (nodes: Record<NodeId, NodeData>, nodeId: NodeId, newParentId: NodeId): boolean => {
  if (nodeId === newParentId) return true
  return isDescendantOf(nodes, newParentId, nodeId)
}
