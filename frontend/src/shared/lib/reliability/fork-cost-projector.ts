import type { NodeData, NodeDatas, NodeId } from '@shared/base-types'
import { VALIDATE_QUERY } from '@shared/lib/commands/command-constants'
import { isValidElectCell, readElectN } from './elect-params'
import { readCommodityN } from './commodity-params'

const isProperAncestor = (ancestorId: NodeId, nodeId: NodeId | undefined, nodes: NodeDatas): boolean => {
  let parent = nodeId ? nodes[nodes[nodeId]?.parent ?? ''] : undefined
  while (parent) {
    if (parent.id === ancestorId) return true
    parent = parent.parent ? nodes[parent.parent] : undefined
  }
  return false
}

const collectAllNestedElects = (node: NodeData, nodes: NodeDatas, excludeId: NodeId): NodeData[] => {
  const found: NodeData[] = []
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    const child = nodes[childId]
    if (!child) continue
    if (isValidElectCell(child.command)) {
      found.push(child)
    } else {
      found.push(...collectAllNestedElects(child, nodes, excludeId))
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
    if (isValidElectCell(child.command)) continue
    count += countImmediateScope(child, nodes, excludeId)
  }
  return count
}

const directlyOwnedNestedElects = (electNode: NodeData, nodes: NodeDatas): NodeData[] => {
  const parentNode = electNode.parent ? nodes[electNode.parent] : undefined
  if (!parentNode) return []

  const allNested = collectAllNestedElects(parentNode, nodes, electNode.id)

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

const countElectChildrenScope = (electNode: NodeData, nodes: NodeDatas): number => {
  let cost = 0
  for (const childId of electNode.children ?? []) {
    const child = nodes[childId]
    if (!child) continue
    if (!child.command || isValidElectCell(child.command) || child.command.startsWith(VALIDATE_QUERY)) continue
    cost += countImmediateScope(child, nodes, '')
  }
  return cost
}

export const projectForkCost = (electNode: NodeData | undefined | null, nodes: NodeDatas): number => {
  if (!electNode) return 0
  const n = readElectN(electNode.command)
  if (!n) return 0

  const parent = electNode.parent ? nodes[electNode.parent] : undefined
  if (!parent) return 0

  const immediateScope = countImmediateScope(parent, nodes, electNode.id)
  const electChildScope = countElectChildrenScope(electNode, nodes)
  const perForkScope = electChildScope > 0 ? electChildScope : immediateScope
  const ownedNested = directlyOwnedNestedElects(electNode, nodes)
  const nestedCost = ownedNested.reduce((sum, nr) => sum + projectForkCost(nr, nodes), 0)

  return n * perForkScope + nestedCost
}
