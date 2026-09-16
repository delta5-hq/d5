import type { NodeData, NodeDatas, NodeId } from '@shared/base-types'
import { STEPS_QUERY, VALIDATE_QUERY } from '@shared/lib/commands/command-constants'
import { clearStepsPrefix } from '@shared/lib/command-regexp'
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

// A node used as a `/steps` step carries an `#N` order marker its command readers do not expect; the
// projector prices it by the same bare command the fork executor resolves after stripping, so this is
// the exact twin of the backend forkCostProjector's orderedNodeCommand.
const orderedNodeCommand = (node: NodeData): string => clearStepsPrefix(node.command ?? '')

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
    if (isValidElectCell(orderedNodeCommand(child))) {
      found.push(child)
    } else {
      found.push(...collectAllNestedElects(child, nodes, excludeId))
    }
  }
  return found
}

const countImmediateScope = (node: NodeData | undefined, nodes: NodeDatas, excludeId: NodeId): number => {
  if (!node) return 0
  let count = readCommodityN(orderedNodeCommand(node))
  const promptIds = new Set(node.prompts ?? [])
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    if (promptIds.has(childId)) continue
    const child = nodes[childId]
    if (!child) continue
    if (isValidElectCell(orderedNodeCommand(child))) continue
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
    const q = orderedNodeCommand(child)
    if (!q || isValidElectCell(q) || q.startsWith(VALIDATE_QUERY)) continue
    cost += countImmediateScope(child, nodes, '')
  }
  return cost
}

// The term an inline modifier wraps (`/elect :n=N <term>`), or null for the bare child form that
// refines its parent's own output. Built as a synthetic parent so the term drives per-fork scope,
// mirroring how the runtime mounts it into each fork.
const electInlineTermParent = (electNode: NodeData, aliases?: DynamicAlias[]): NodeData | null => {
  const trailing = readElectTrailingText(orderedNodeCommand(electNode))
  const inlineTerm = parseInlineTerm(trailing, aliases)
  return inlineTerm ? buildSyntheticTermParent(electNode.id, inlineTerm, electNode.parent) : null
}

const isSequencingTerm = (termParent: NodeData | null, aliases?: DynamicAlias[]): boolean =>
  Boolean(termParent) &&
  extractQueryTypeFromCommand(termParent!.command, aliases) === extractQueryTypeFromCommand(STEPS_QUERY, aliases)

// `/elect :n=N /steps` runs the elect's own ordered step subtree once per fork. Its per-fork cost is
// the sum of each step's cost — a nested elect step compounds through projectForkCost, a plain step
// costs its commodity scope. Assertions (/validate) and prompt outputs gate rather than generate.
const sequenceScopeCost = (electNode: NodeData, nodes: NodeDatas, aliases?: DynamicAlias[]): number => {
  const promptIds = new Set(electNode.prompts ?? [])
  let cost = 0
  for (const childId of electNode.children ?? []) {
    if (promptIds.has(childId)) continue
    const child = nodes[childId]
    if (!child) continue
    const command = orderedNodeCommand(child)
    if (!command || command.startsWith(VALIDATE_QUERY)) continue
    cost += isValidElectCell(command)
      ? projectForkCost(child, nodes, false, electInlineTermParent(child, aliases), aliases)
      : countImmediateScope(child, nodes, '')
  }
  return cost
}

export const canProjectSourceCandidate = (
  electNode: NodeData | undefined | null,
  nodes: NodeDatas,
  aliases?: DynamicAlias[],
): boolean => {
  if (!electNode?.parent) return false
  const n = readElectN(orderedNodeCommand(electNode))
  if (!n || n <= 1) return false
  // An inline term generates a fresh candidate every fork, so no prior parent output is a candidate.
  if (electInlineTermParent(electNode, aliases)) return false
  const parent = nodes[electNode.parent]
  if (!parent) return false
  const electChildScope = countElectChildrenScope(electNode, nodes)
  return electChildScope === 0 && admitsSourceCandidate({ admitSourceCandidate: true, n, electNode, parent, nodes })
}

// termParent is the synthetic parent of an inline /elect :n=N <term>; when present the term, not the
// enclosing ancestor, drives the per-fork scope. Postfix elects pass null and price against their
// real parent in the node map.
export const projectForkCost = (
  electNode: NodeData | undefined | null,
  nodes: NodeDatas,
  admitSourceCandidate = false,
  termParent: NodeData | null = null,
  aliases?: DynamicAlias[],
): number => {
  if (!electNode) return 0
  const n = readElectN(orderedNodeCommand(electNode))
  if (!n) return 0

  const effectiveTermParent = termParent ?? electInlineTermParent(electNode, aliases)
  if (isSequencingTerm(effectiveTermParent, aliases)) {
    return n * sequenceScopeCost(electNode, nodes, aliases)
  }

  const parent = effectiveTermParent ?? (electNode.parent ? nodes[electNode.parent] : undefined)
  if (!parent) return 0

  const immediateScope = countImmediateScope(parent, nodes, electNode.id)
  const electChildScope = countElectChildrenScope(electNode, nodes)
  const perForkScope = electChildScope > 0 ? electChildScope : immediateScope
  const ownedNested = directlyOwnedNestedElects(electNode, nodes)
  const nestedCost = ownedNested.reduce((sum, nr) => sum + projectForkCost(nr, nodes, false, null, aliases), 0)
  const sourceCandidateSaving =
    electChildScope === 0 && admitsSourceCandidate({ admitSourceCandidate, n, electNode, parent, nodes }) ? 1 : 0

  return n * perForkScope + nestedCost - sourceCandidateSaving
}

export const projectElectCostPreview = (
  electNode: NodeData | undefined | null,
  nodes: NodeDatas,
  aliases?: DynamicAlias[],
): ElectCostPreview | null => {
  if (!electNode || !isValidElectCell(orderedNodeCommand(electNode))) return null
  const cost = projectForkCost(electNode, nodes, canProjectSourceCandidate(electNode, nodes, aliases), null, aliases)
  const limit = readForkLimit(orderedNodeCommand(electNode))
  return { cost, limitExceeded: exceedsForkLimit(cost, limit) }
}

export const projectSelectedNodeElectCostPreview = (
  selectedNode: NodeData | undefined | null,
  nodes: NodeDatas,
  aliases?: DynamicAlias[],
): ElectCostPreview | null => {
  if (!selectedNode) return null
  return projectElectCostPreview(selectedNode, nodes, aliases)
}
