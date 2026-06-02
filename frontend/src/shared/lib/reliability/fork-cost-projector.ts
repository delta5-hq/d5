import type { NodeData, NodeDatas, NodeId } from '@shared/base-types'
import { VALIDATE_QUERY } from '@shared/lib/commands/command-constants'
import { isValidRefineCell, readRefineN } from './refine-params'
import { readCommodityN } from './commodity-params'

const isProperAncestor = (ancestorId: NodeId, nodeId: NodeId | undefined, nodes: NodeDatas): boolean => {
  let parent = nodeId ? nodes[nodes[nodeId]?.parent ?? ''] : undefined
  while (parent) {
    if (parent.id === ancestorId) return true
    parent = parent.parent ? nodes[parent.parent] : undefined
  }
  return false
}

const collectAllNestedRefines = (node: NodeData, nodes: NodeDatas, excludeId: NodeId): NodeData[] => {
  const found: NodeData[] = []
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    const child = nodes[childId]
    if (!child) continue
    if (isValidRefineCell(child.command)) {
      found.push(child)
    } else {
      found.push(...collectAllNestedRefines(child, nodes, excludeId))
    }
  }
  return found
}

const countImmediateScope = (node: NodeData | undefined, nodes: NodeDatas, excludeId: NodeId): number => {
  if (!node) return 0
  let count = readCommodityN(node.command)
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    const child = nodes[childId]
    if (!child) continue
    if (isValidRefineCell(child.command)) continue
    count += countImmediateScope(child, nodes, excludeId)
  }
  return count
}

const directlyOwnedNestedRefines = (refineNode: NodeData, nodes: NodeDatas): NodeData[] => {
  const parentNode = refineNode.parent ? nodes[refineNode.parent] : undefined
  if (!parentNode) return []

  const allNested = collectAllNestedRefines(parentNode, nodes, refineNode.id)

  return allNested.filter(candidate => {
    if (!isProperAncestor(parentNode.id, candidate.parent, nodes)) return false
    return !allNested.some(
      other =>
        other.id !== candidate.id &&
        isProperAncestor(parentNode.id, other.parent, nodes) &&
        !!other.parent &&
        isProperAncestor(other.parent, candidate.parent, nodes),
    )
  })
}

const countRefineChildrenScope = (refineNode: NodeData, nodes: NodeDatas): number => {
  let cost = 0
  for (const childId of refineNode.children ?? []) {
    const child = nodes[childId]
    if (!child) continue
    if (!child.command || isValidRefineCell(child.command) || child.command.startsWith(VALIDATE_QUERY)) continue
    cost += countImmediateScope(child, nodes, '')
  }
  return cost
}

export const projectForkCost = (refineNode: NodeData | undefined | null, nodes: NodeDatas): number => {
  if (!refineNode) return 0
  const n = readRefineN(refineNode.command)
  if (!n) return 0

  const parent = refineNode.parent ? nodes[refineNode.parent] : undefined
  if (!parent) return 0

  const immediateScope = countImmediateScope(parent, nodes, refineNode.id)
  const refineChildScope = countRefineChildrenScope(refineNode, nodes)
  const perForkScope = refineChildScope > 0 ? refineChildScope : immediateScope
  const ownedNested = directlyOwnedNestedRefines(refineNode, nodes)
  const nestedCost = ownedNested.reduce((sum, nr) => sum + projectForkCost(nr, nodes), 0)

  return n * perForkScope + nestedCost
}
