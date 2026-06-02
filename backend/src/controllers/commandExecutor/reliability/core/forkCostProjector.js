import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidRefineCell, readRefineN} from './refineParams'
import {readCommodityN} from './commodityParams'
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

const collectAllNestedRefines = (node, store, excludeId) => {
  const found = []
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    const child = store.getNode(childId)
    if (!child) continue
    if (isValidRefineCell(getNodeCommand(child))) {
      found.push(child)
    } else {
      found.push(...collectAllNestedRefines(child, store, excludeId))
    }
  }
  return found
}

const countImmediateScope = (node, store, excludeId) => {
  if (!node) return 0
  let count = readCommodityN(getNodeCommand(node))
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    const child = store.getNode(childId)
    if (!child) continue
    if (isValidRefineCell(getNodeCommand(child))) continue
    count += countImmediateScope(child, store, excludeId)
  }
  return count
}

const directlyOwnedNestedRefines = (refineNode, store) => {
  const parentNode = store.getNode(refineNode.parent)
  if (!parentNode) return []

  const allNested = collectAllNestedRefines(parentNode, store, refineNode.id)

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

// Count LLM-execution cost of non-post-processor, non-refine direct children of
// a /refine node. These execute inside each fork (runCommand 'in-progress' path)
// and must be included so :limit= refuses correctly when commodity :n= is present.
const countRefineChildrenScope = (refineNode, store) => {
  let cost = 0
  for (const childId of refineNode.children ?? []) {
    const child = store.getNode(childId)
    if (!child) continue
    const q = getNodeCommand(child)
    if (!q || isValidRefineCell(q) || q.startsWith(VALIDATE_QUERY)) continue
    cost += countImmediateScope(child, store, null)
  }
  return cost
}

export const projectForkCost = (refineNode, store) => {
  const n = readRefineN(getNodeCommand(refineNode))
  if (!n) return 0

  const parent = store.getNode(refineNode.parent)
  if (!parent) return 0

  const immediateScope = countImmediateScope(parent, store, refineNode.id)
  // If /refine has non-post-processor children that execute per fork, their
  // commodity cost replaces the parent-scope cost (parent re-runs are overhead,
  // not the primary cost driver once inner commands are present).
  const refineChildScope = countRefineChildrenScope(refineNode, store)
  const perForkScope = refineChildScope > 0 ? refineChildScope : immediateScope
  const ownedNested = directlyOwnedNestedRefines(refineNode, store)
  const nestedCost = ownedNested.reduce((sum, nr) => sum + projectForkCost(nr, store), 0)

  return n * perForkScope + nestedCost
}
