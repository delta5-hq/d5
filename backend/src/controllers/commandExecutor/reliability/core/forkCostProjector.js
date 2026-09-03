import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidElectCell, readElectN} from './electParams'
import {readCommodityN} from './commodityParams'
import {admitsSourceCandidate} from './sourceCandidateAdmission'
import {VALIDATE_QUERY} from '../../constants/validate'

const isProperAncestor = (ancestorId, nodeId, store) => {
  let current = store.getNode(nodeId)
  let parent = current ? store.getNode(current.parent) : null
  while (parent) {
    if (parent.id === ancestorId) return true
    parent = store.getNode(parent.parent)
  }
  return false
}

const collectAllNestedElects = (node, store, excludeId) => {
  const found = []
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    const child = store.getNode(childId)
    if (!child) continue
    if (isValidElectCell(getNodeCommand(child))) {
      found.push(child)
    } else {
      found.push(...collectAllNestedElects(child, store, excludeId))
    }
  }
  return found
}

const countImmediateScope = (node, store, excludeId) => {
  if (!node) return 0
  let count = readCommodityN(getNodeCommand(node))
  const promptIds = new Set(node.prompts ?? [])
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    if (promptIds.has(childId)) continue
    const child = store.getNode(childId)
    if (!child) continue
    if (isValidElectCell(getNodeCommand(child))) continue
    count += countImmediateScope(child, store, excludeId)
  }
  return count
}

const directlyOwnedNestedElects = (parentNode, electNode, store) => {
  const allNested = collectAllNestedElects(parentNode, store, electNode.id)

  return allNested.filter(candidate => {
    if (!isProperAncestor(parentNode.id, candidate.parent, store)) return false
    return !allNested.some(
      other =>
        other.id !== candidate.id &&
        isProperAncestor(parentNode.id, other.parent, store) &&
        isProperAncestor(other.parent, candidate.parent, store),
    )
  })
}

// Count LLM-execution cost of non-post-processor, non-elect direct children of
// a /elect node. These execute inside each fork (runCommand 'in-progress' path)
// and must be included so :limit= refuses correctly when commodity :n= is present.
const countElectChildrenScope = (electNode, store) => {
  let cost = 0
  const promptIds = new Set(electNode.prompts ?? [])
  for (const childId of electNode.children ?? []) {
    if (promptIds.has(childId)) continue
    const child = store.getNode(childId)
    if (!child) continue
    const q = getNodeCommand(child)
    if (!q || isValidElectCell(q) || q.startsWith(VALIDATE_QUERY)) continue
    cost += countImmediateScope(child, store, null)
  }
  return cost
}

// termParent is the synthetic parent of an inline /elect :n=N <term>; when present the term,
// not the enclosing ancestor, drives the per-fork scope. Postfix elects pass null and price
// against their real parent in the store.
export const projectForkCost = (electNode, store, admitSourceCandidate = false, termParent = null) => {
  const n = readElectN(getNodeCommand(electNode))
  if (!n) return 0

  const parent = termParent ?? store.getNode(electNode.parent)
  if (!parent) return 0

  const immediateScope = countImmediateScope(parent, store, electNode.id)
  // If /elect has non-post-processor children that execute per fork, their
  // commodity cost replaces the parent-scope cost (parent re-runs are overhead,
  // not the primary cost driver once inner commands are present).
  const electChildScope = countElectChildrenScope(electNode, store)
  const perForkScope = electChildScope > 0 ? electChildScope : immediateScope
  const ownedNested = directlyOwnedNestedElects(parent, electNode, store)
  const nestedCost = ownedNested.reduce((sum, nr) => sum + projectForkCost(nr, store), 0)
  const sourceCandidateSaving =
    electChildScope === 0 &&
    admitsSourceCandidate({
      admitSourceCandidate,
      n,
      parentNode: parent,
      store,
    })
      ? 1
      : 0

  return n * perForkScope + nestedCost - sourceCandidateSaving
}
