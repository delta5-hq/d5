import type { NodeData, NodeDatas, NodeId } from '@shared/base-types'
import { VALIDATE_QUERY } from '@shared/lib/commands/command-constants'
import { isValidElectCell, readElectN, readElectTrailingText } from './elect-params'
import { readCommodityN } from './commodity-params'
import { exceedsForkLimit, readForkLimit } from './fork-limit-parser'
import { extractQueryTypeFromCommand, type DynamicAlias } from '../command-querytype-mapper'
import { admitsSourceCandidate } from './source-candidate-admission'
import { parseInlineTerm, buildSyntheticTermParent } from './inline-term-parser'

export interface ElectCostPreview {
  cost: number
  limitExceeded: boolean
}

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
  const promptIds = new Set(node.prompts ?? [])
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    if (promptIds.has(childId)) continue
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
  const promptIds = new Set(electNode.prompts ?? [])
  for (const childId of electNode.children ?? []) {
    if (promptIds.has(childId)) continue
    const child = nodes[childId]
    if (!child) continue
    if (!child.command || isValidElectCell(child.command) || child.command.startsWith(VALIDATE_QUERY)) continue
    cost += countImmediateScope(child, nodes, '')
  }
  return cost
}

export const canProjectSourceCandidate = (
  electNode: NodeData | undefined | null,
  nodes: NodeDatas,
  parentQueryType?: string,
): boolean => {
  if (!electNode?.parent) return false
  const n = readElectN(electNode.command)
  if (!n || n <= 1) return false
  const parent = nodes[electNode.parent]
  if (!parent) return false
  const electChildScope = countElectChildrenScope(electNode, nodes)
  return (
    electChildScope === 0 &&
    admitsSourceCandidate({ admitSourceCandidate: true, n, parentQueryType, electNode, parent, nodes })
  )
}

export const projectForkCost = (
  electNode: NodeData | undefined | null,
  nodes: NodeDatas,
  admitSourceCandidate = false,
): number => {
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
  const sourceCandidateSaving =
    electChildScope === 0 &&
    admitsSourceCandidate({ admitSourceCandidate, n, parentQueryType: undefined, electNode, parent, nodes })
      ? 1
      : 0

  return n * perForkScope + nestedCost - sourceCandidateSaving
}

export const projectElectCostPreview = (
  electNode: NodeData | undefined | null,
  nodes: NodeDatas,
  parentQueryType?: string,
): ElectCostPreview | null => {
  if (!electNode || !isValidElectCell(electNode.command)) return null
  const cost = projectForkCost(electNode, nodes, canProjectSourceCandidate(electNode, nodes, parentQueryType))
  const limit = readForkLimit(electNode.command)
  return { cost, limitExceeded: exceedsForkLimit(cost, limit) }
}

const buildInlineEnrichedInputs = (
  selectedNode: NodeData,
  nodes: NodeDatas,
  inlineTerm: string,
): { enrichedElect: NodeData; enrichedNodes: NodeDatas } => {
  const syntheticParent = buildSyntheticTermParent(selectedNode.id, inlineTerm, selectedNode.parent)
  const ancestorId = selectedNode.parent
  const ancestor = ancestorId ? nodes[ancestorId] : undefined
  const enrichedAncestor = ancestor
    ? {
        ...ancestor,
        children: ancestor.children
          ? ancestor.children.map(id => (id === selectedNode.id ? syntheticParent.id : id))
          : [syntheticParent.id],
      }
    : undefined
  return {
    enrichedElect: { ...selectedNode, parent: syntheticParent.id },
    enrichedNodes: {
      ...nodes,
      [syntheticParent.id]: syntheticParent,
      ...(ancestorId && enrichedAncestor ? { [ancestorId]: enrichedAncestor } : {}),
    },
  }
}

export const projectSelectedNodeElectCostPreview = (
  selectedNode: NodeData | undefined | null,
  nodes: NodeDatas,
  aliases?: DynamicAlias[],
): ElectCostPreview | null => {
  if (!selectedNode) return null

  const trailingText = readElectTrailingText(selectedNode.command ?? '')
  const inlineTerm = parseInlineTerm(trailingText, aliases)

  if (inlineTerm) {
    const { enrichedElect, enrichedNodes } = buildInlineEnrichedInputs(selectedNode, nodes, inlineTerm)
    const parentNode = enrichedElect.parent ? enrichedNodes[enrichedElect.parent] : undefined
    const parentQueryType = extractQueryTypeFromCommand(parentNode?.command, aliases)
    return projectElectCostPreview(enrichedElect, enrichedNodes, parentQueryType)
  }

  const parentNode = selectedNode.parent ? nodes[selectedNode.parent] : undefined
  const parentQueryType = extractQueryTypeFromCommand(parentNode?.command, aliases)
  return projectElectCostPreview(selectedNode, nodes, parentQueryType)
}
