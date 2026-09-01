export type TreeDropPosition = 'before' | 'inside' | 'after'

export interface TreeDragBounds {
  top: number
  height: number
}

export interface TreeMoveNode {
  parent?: string
  children?: string[]
}

export interface TreeMoveRequest {
  nodeId: string
  parentId: string
  insertionIndex: number
  expandTargetId?: string
}

export function getTreeDropPosition(clientY: number, bounds: TreeDragBounds): TreeDropPosition {
  const relativeY = clientY - bounds.top
  if (relativeY < bounds.height * 0.25) return 'before'
  if (relativeY > bounds.height * 0.75) return 'after'
  return 'inside'
}

export function getTreeMoveRequest(
  nodes: Record<string, TreeMoveNode>,
  nodeId: string,
  targetNodeId: string,
  position: TreeDropPosition,
): TreeMoveRequest | undefined {
  if (nodeId === targetNodeId) return undefined

  const node = nodes[nodeId]
  const targetNode = nodes[targetNodeId]
  if (!node || !targetNode || !node.parent) return undefined

  const targetParentId = position === 'inside' ? targetNodeId : targetNode.parent
  if (!targetParentId) return undefined

  if (position === 'inside') {
    return {
      nodeId,
      parentId: targetParentId,
      insertionIndex: targetNode.children?.length ?? 0,
      expandTargetId: targetNodeId,
    }
  }

  const targetSiblings = nodes[targetParentId]?.children ?? []
  const sourceIndex = node.parent === targetParentId ? targetSiblings.indexOf(nodeId) : -1
  const targetIndex = targetSiblings.indexOf(targetNodeId)
  if (targetIndex < 0) return undefined

  const requestedIndex = targetIndex + (position === 'after' ? 1 : 0)
  const insertionIndex = sourceIndex >= 0 && sourceIndex < requestedIndex ? requestedIndex - 1 : requestedIndex
  return { nodeId, parentId: targetParentId, insertionIndex }
}
