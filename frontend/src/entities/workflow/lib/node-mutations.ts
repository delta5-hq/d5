import type { NodeData, NodeId, EdgeData, EdgeId } from '@shared/base-types'
import { generateUniqueNodeId, generateEdgeId } from '@shared/lib/generate-id'
import { isValidNodeData, getDescendantIds, hasCircularReference } from './node-validation'
import { remapTitleProjection, sanitizeTitleProjections, withoutTitleProjection } from './title-projection'

export interface NodeMutationResult {
  nodes: Record<NodeId, NodeData>
  newId: NodeId
}

export interface RemoveNodeResult {
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
  removedNodeIds: NodeId[]
}

export interface DuplicateNodeResult {
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
  newRootId: NodeId
  idMapping: Record<NodeId, NodeId>
}

export class NodeMutationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'NodeMutationError'
  }
}

export const createRootNode = (nodes: Record<NodeId, NodeData>, nodeData: Partial<NodeData>): NodeMutationResult => {
  if (!isValidNodeData(nodeData)) {
    throw new NodeMutationError('Invalid node data', 'INVALID_NODE_DATA')
  }

  const existingRoot = Object.values(nodes).find(n => !n.parent)
  if (existingRoot) {
    throw new NodeMutationError('Root node already exists', 'ROOT_EXISTS')
  }

  if (nodeData.parent) {
    throw new NodeMutationError('Root node cannot have parent', 'ROOT_WITH_PARENT')
  }

  const newId = generateUniqueNodeId(nodes)
  const newNode: NodeData = {
    title: '',
    ...nodeData,
    id: newId,
    children: nodeData.children ?? [],
  }

  return {
    nodes: { ...nodes, [newId]: newNode },
    newId,
  }
}

export const addChildNode = (
  nodes: Record<NodeId, NodeData>,
  parentId: NodeId,
  nodeData: Partial<NodeData>,
): NodeMutationResult => {
  if (!isValidNodeData(nodeData)) {
    throw new NodeMutationError('Invalid node data', 'INVALID_NODE_DATA')
  }

  const parentNode = nodes[parentId]
  if (!parentNode) {
    throw new NodeMutationError(`Parent node "${parentId}" not found`, 'PARENT_NOT_FOUND')
  }

  const newId = generateUniqueNodeId(nodes)

  if (newId === parentId) {
    throw new NodeMutationError('Generated ID matches parent ID', 'SELF_PARENT')
  }

  const newNode: NodeData = {
    title: '',
    ...nodeData,
    id: newId,
    parent: parentId,
    children: nodeData.children ?? [],
  }

  const updatedParent: NodeData = {
    ...parentNode,
    children: [...(parentNode.children ?? []), newId],
  }

  return {
    nodes: {
      ...nodes,
      [parentId]: updatedParent,
      [newId]: newNode,
    },
    newId,
  }
}

export const updateNode = (
  nodes: Record<NodeId, NodeData>,
  nodeId: NodeId,
  updates: Partial<Omit<NodeData, 'id' | 'parent'>>,
): Record<NodeId, NodeData> => {
  const existingNode = nodes[nodeId]
  if (!existingNode) {
    throw new NodeMutationError(`Node "${nodeId}" not found`, 'NODE_NOT_FOUND')
  }

  if (!isValidNodeData(updates)) {
    throw new NodeMutationError('Invalid update data', 'INVALID_NODE_DATA')
  }

  const updatedNode: NodeData = {
    ...existingNode,
    ...updates,
    id: existingNode.id,
    parent: existingNode.parent,
  }

  return sanitizeTitleProjections({ ...nodes, [nodeId]: updatedNode })
}

export const removeNode = (
  nodes: Record<NodeId, NodeData>,
  edges: Record<EdgeId, EdgeData>,
  nodeId: NodeId,
): RemoveNodeResult => {
  const node = nodes[nodeId]
  if (!node) {
    throw new NodeMutationError(`Node "${nodeId}" not found`, 'NODE_NOT_FOUND')
  }

  if (!node.parent) {
    throw new NodeMutationError('Cannot remove root node', 'CANNOT_REMOVE_ROOT')
  }

  const descendantIds = getDescendantIds(nodes, nodeId)
  const removedNodeIds = [nodeId, ...descendantIds]
  const removedSet = new Set(removedNodeIds)

  const newNodes = { ...nodes }
  for (const id of removedNodeIds) {
    delete newNodes[id]
  }

  const parentNode = newNodes[node.parent]
  if (parentNode) {
    newNodes[node.parent] = {
      ...parentNode,
      children: (parentNode.children ?? []).filter(id => id !== nodeId),
      ...(parentNode.prompts && { prompts: parentNode.prompts.filter(id => id !== nodeId) }),
    }
  }

  const newEdges = { ...edges }
  for (const [edgeId, edge] of Object.entries(edges)) {
    if (removedSet.has(edge.start) || removedSet.has(edge.end)) {
      delete newEdges[edgeId]
    }
  }

  return { nodes: sanitizeTitleProjections(newNodes), edges: newEdges, removedNodeIds }
}

export const moveNode = (
  nodes: Record<NodeId, NodeData>,
  nodeId: NodeId,
  newParentId: NodeId,
  insertionIndex?: number,
): Record<NodeId, NodeData> => {
  const node = nodes[nodeId]
  if (!node) {
    throw new NodeMutationError(`Node "${nodeId}" not found`, 'NODE_NOT_FOUND')
  }

  if (!node.parent) {
    throw new NodeMutationError('Cannot move root node', 'CANNOT_MOVE_ROOT')
  }

  if (!nodes[newParentId]) {
    throw new NodeMutationError(`Target parent "${newParentId}" not found`, 'TARGET_NOT_FOUND')
  }

  if (hasCircularReference(nodes, nodeId, newParentId)) {
    throw new NodeMutationError('Move would create circular reference', 'CIRCULAR_REFERENCE')
  }

  const oldParentId = node.parent
  const oldSiblings = nodes[oldParentId]?.children ?? []
  const newSiblings = nodes[newParentId]?.children ?? []
  const sameParent = oldParentId === newParentId
  if (sameParent && insertionIndex === undefined) {
    return nodes
  }

  const siblingsWithoutMovedNode = sameParent ? oldSiblings.filter(id => id !== nodeId) : newSiblings
  const targetIndex =
    insertionIndex === undefined
      ? siblingsWithoutMovedNode.length
      : Math.max(0, Math.min(insertionIndex, siblingsWithoutMovedNode.length))
  const nextTargetChildren = [
    ...siblingsWithoutMovedNode.slice(0, targetIndex),
    nodeId,
    ...siblingsWithoutMovedNode.slice(targetIndex),
  ]

  if (sameParent) {
    const currentIndex = oldSiblings.indexOf(nodeId)
    if (currentIndex === targetIndex) return nodes

    return sanitizeTitleProjections({
      ...nodes,
      [oldParentId]: {
        ...nodes[oldParentId],
        children: nextTargetChildren,
      },
    })
  }

  const newNodes = { ...nodes }

  const oldParent = newNodes[oldParentId]
  if (oldParent) {
    newNodes[oldParentId] = {
      ...oldParent,
      children: (oldParent.children ?? []).filter(id => id !== nodeId),
    }
  }

  const newParent = newNodes[newParentId]
  newNodes[newParentId] = {
    ...newParent,
    children: nextTargetChildren,
  }

  newNodes[nodeId] = {
    ...node,
    parent: newParentId,
  }

  return sanitizeTitleProjections(newNodes)
}

export const addPromptChild = (
  nodes: Record<NodeId, NodeData>,
  parentId: NodeId,
  nodeData: Partial<NodeData>,
): NodeMutationResult => {
  const result = addChildNode(nodes, parentId, nodeData)
  const parentNode = result.nodes[parentId]

  result.nodes[parentId] = {
    ...parentNode,
    prompts: [...(parentNode.prompts ?? []), result.newId],
  }

  return result
}

export const removePromptChildren = (nodes: Record<NodeId, NodeData>, parentId: NodeId): Record<NodeId, NodeData> => {
  const parentNode = nodes[parentId]
  if (!parentNode) {
    throw new NodeMutationError(`Parent node "${parentId}" not found`, 'PARENT_NOT_FOUND')
  }

  const promptIds = parentNode.prompts ?? []
  if (promptIds.length === 0) {
    return nodes
  }

  const promptIdSet = new Set(promptIds)
  const allRemovedIds = new Set<NodeId>()

  for (const promptId of promptIds) {
    allRemovedIds.add(promptId)
    for (const descendantId of getDescendantIds(nodes, promptId)) {
      allRemovedIds.add(descendantId)
    }
  }

  const newNodes = { ...nodes }

  for (const id of allRemovedIds) {
    delete newNodes[id]
  }

  newNodes[parentId] = {
    ...parentNode,
    children: (parentNode.children ?? []).filter(childId => !promptIdSet.has(childId)),
    prompts: [],
  }

  return { ...newNodes, [parentId]: withoutTitleProjection(newNodes[parentId]) }
}

export const orphanMatchingPromptChildren = (
  nodes: Record<NodeId, NodeData>,
  parentId: NodeId,
  incomingTitles: Readonly<Set<string>>,
): Record<NodeId, NodeData> => {
  const parentNode = nodes[parentId]
  if (!parentNode) {
    throw new NodeMutationError(`Parent node "${parentId}" not found`, 'PARENT_NOT_FOUND')
  }

  const promptIds = parentNode.prompts ?? []
  if (promptIds.length === 0) return nodes

  const matchingPromptIds = promptIds.filter(id => {
    const child = nodes[id]
    return child && incomingTitles.has(child.title ?? '')
  })

  if (matchingPromptIds.length === 0) return nodes

  const matchingSet = new Set(matchingPromptIds)

  return {
    ...nodes,
    [parentId]: {
      ...parentNode,
      prompts: promptIds.filter(id => !matchingSet.has(id)),
    },
  }
}

export const duplicateNode = (
  nodes: Record<NodeId, NodeData>,
  edges: Record<EdgeId, EdgeData>,
  nodeId: NodeId,
  targetParentId?: NodeId,
): DuplicateNodeResult => {
  const sourceNode = nodes[nodeId]
  if (!sourceNode) {
    throw new NodeMutationError(`Node "${nodeId}" not found`, 'NODE_NOT_FOUND')
  }

  const parentId = targetParentId ?? sourceNode.parent
  if (!parentId) {
    throw new NodeMutationError('Cannot duplicate root node without target parent', 'NO_TARGET_PARENT')
  }

  if (!nodes[parentId]) {
    throw new NodeMutationError(`Target parent "${parentId}" not found`, 'TARGET_NOT_FOUND')
  }

  const descendantIds = getDescendantIds(nodes, nodeId)
  const sourceIds = [nodeId, ...descendantIds]

  const idMapping: Record<NodeId, NodeId> = {}
  const usedIds = new Set(Object.keys(nodes))

  for (const id of sourceIds) {
    const newId = generateUniqueNodeId(usedIds)
    usedIds.add(newId)
    idMapping[id] = newId
  }

  const newNodes = { ...nodes }

  for (const sourceId of sourceIds) {
    const source = nodes[sourceId]
    const newId = idMapping[sourceId]

    const isRoot = sourceId === nodeId
    const newParent = isRoot ? parentId : idMapping[source.parent!]

    const newNode: NodeData = {
      ...source,
      id: newId,
      parent: newParent,
      children: (source.children ?? []).map(childId => idMapping[childId]).filter(Boolean),
      ...(source.prompts !== undefined && {
        // Persisted workflows encode an absent prompts list as null. Normalize
        // that wire shape instead of attempting to map it during duplication.
        prompts: Array.isArray(source.prompts)
          ? source.prompts.map(promptId => idMapping[promptId]).filter((id): id is NodeId => Boolean(id))
          : undefined,
      }),
    }

    newNodes[newId] = remapTitleProjection(newNode, idMapping)
  }

  const targetParent = newNodes[parentId]
  newNodes[parentId] = {
    ...targetParent,
    children: [...(targetParent.children ?? []), idMapping[nodeId]],
  }

  const newEdges = { ...edges }
  const sourceIdSet = new Set(sourceIds)

  for (const edge of Object.values(edges)) {
    const startInSubtree = sourceIdSet.has(edge.start)
    const endInSubtree = sourceIdSet.has(edge.end)

    if (startInSubtree && endInSubtree) {
      const newStart = idMapping[edge.start]
      const newEnd = idMapping[edge.end]
      const newEdgeId = generateEdgeId(newStart, newEnd)
      newEdges[newEdgeId] = {
        ...edge,
        id: newEdgeId,
        start: newStart,
        end: newEnd,
      }
    }
  }

  return {
    nodes: newNodes,
    edges: newEdges,
    newRootId: idMapping[nodeId],
    idMapping,
  }
}

export interface WrapNodesResult {
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
  newParentId: NodeId
}

export const wrapNodesInParent = (
  nodes: Record<NodeId, NodeData>,
  edges: Record<EdgeId, EdgeData>,
  nodeIds: NodeId[],
): WrapNodesResult => {
  if (nodeIds.length === 0) {
    throw new NodeMutationError('No nodes to wrap', 'NODE_NOT_FOUND')
  }

  const firstNode = nodes[nodeIds[0]]
  if (!firstNode) {
    throw new NodeMutationError(`Node "${nodeIds[0]}" not found`, 'NODE_NOT_FOUND')
  }
  if (!firstNode.parent) {
    throw new NodeMutationError('Cannot wrap root node', 'CANNOT_MOVE_ROOT')
  }

  const sharedParentId = firstNode.parent
  for (const id of nodeIds) {
    const n = nodes[id]
    if (!n) throw new NodeMutationError(`Node "${id}" not found`, 'NODE_NOT_FOUND')
    if (n.parent !== sharedParentId) {
      throw new NodeMutationError('All wrapped nodes must share the same parent', 'PARENT_NOT_FOUND')
    }
  }

  const parentNode = nodes[sharedParentId]
  const parentChildren = parentNode.children ?? []
  const wrapSet = new Set(nodeIds)

  const orderedToWrap = parentChildren.filter(id => wrapSet.has(id))
  const insertionIndex = parentChildren.indexOf(orderedToWrap[0])

  const newParentId = generateUniqueNodeId(nodes)
  const newParent: NodeData = {
    title: '',
    id: newParentId,
    parent: sharedParentId,
    children: orderedToWrap,
  }

  const newNodes: Record<NodeId, NodeData> = { ...nodes, [newParentId]: newParent }

  const remainingChildren = parentChildren.filter(id => !wrapSet.has(id))
  remainingChildren.splice(insertionIndex, 0, newParentId)
  newNodes[sharedParentId] = { ...parentNode, children: remainingChildren }

  for (const id of orderedToWrap) {
    newNodes[id] = { ...newNodes[id], parent: newParentId }
  }

  return { nodes: sanitizeTitleProjections(newNodes), edges, newParentId }
}
