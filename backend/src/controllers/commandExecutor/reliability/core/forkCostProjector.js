import {getNodeCommand} from '../../commands/utils/isCommand'
import {clearStepsPrefix} from '../../constants/steps'
import {isValidElectCell, readElectN, readElectTrailingText} from './electParams'
import {parseInlineTerm, buildSyntheticTermParent} from './inlineTermParser'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {STEPS_QUERY_TYPE} from '../../constants/steps'
import {readCommodityN} from './commodityParams'
import {admitsSourceCandidate} from './sourceCandidateAdmission'
import {VALIDATE_QUERY} from '../../constants/validate'

// A node used as a `/steps` step carries an `#N` order marker its command readers do not expect; the
// projector must price it by the same bare command the fork executor resolves after stripping.
const orderedNodeCommand = node => clearStepsPrefix(getNodeCommand(node) || '')

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
    if (isValidElectCell(orderedNodeCommand(child))) {
      found.push(child)
    } else {
      found.push(...collectAllNestedElects(child, store, excludeId))
    }
  }
  return found
}

const countImmediateScope = (node, store, excludeId) => {
  if (!node) return 0
  let count = readCommodityN(orderedNodeCommand(node))
  const promptIds = new Set(node.prompts ?? [])
  for (const childId of node.children ?? []) {
    if (childId === excludeId) continue
    if (promptIds.has(childId)) continue
    const child = store.getNode(childId)
    if (!child) continue
    if (isValidElectCell(orderedNodeCommand(child))) continue
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
    const q = orderedNodeCommand(child)
    if (!q || isValidElectCell(q) || q.startsWith(VALIDATE_QUERY)) continue
    cost += countImmediateScope(child, store, null)
  }
  return cost
}

// The term an inline modifier wraps (`/elect :n=N <term>`), or null for the bare child form that
// refines its parent's own output. Built as a synthetic parent so the term drives per-fork scope,
// mirroring how resolveElectCell mounts it into each fork.
const electInlineTermParent = (electNode, store) => {
  const trailing = readElectTrailingText(orderedNodeCommand(electNode))
  const inlineTerm = parseInlineTerm(trailing, store._aliases)
  return inlineTerm ? buildSyntheticTermParent(electNode.id, inlineTerm, electNode.parent) : null
}

const isSequencingTerm = (termParent, store) =>
  Boolean(termParent) && resolveCommand(termParent.command, store._aliases).queryType === STEPS_QUERY_TYPE

// `/elect :n=N /steps` runs the elect's own ordered step subtree once per fork. Its per-fork cost is
// the sum of each step's cost — a nested elect step compounds through projectForkCost, a plain step
// costs its commodity scope. Assertions (/validate) and prompt outputs gate rather than generate.
const sequenceScopeCost = (electNode, store) => {
  const promptIds = new Set(electNode.prompts ?? [])
  let cost = 0
  for (const childId of electNode.children ?? []) {
    if (promptIds.has(childId)) continue
    const child = store.getNode(childId)
    if (!child) continue
    const command = orderedNodeCommand(child)
    if (!command || command.startsWith(VALIDATE_QUERY)) continue
    cost += isValidElectCell(command)
      ? projectForkCost(child, store, false, electInlineTermParent(child, store))
      : countImmediateScope(child, store, null)
  }
  return cost
}

// termParent is the synthetic parent of an inline /elect :n=N <term>; when present the term,
// not the enclosing ancestor, drives the per-fork scope. Postfix elects pass null and price
// against their real parent in the store.
export const projectForkCost = (electNode, store, admitSourceCandidate = false, termParent = null) => {
  const n = readElectN(orderedNodeCommand(electNode))
  if (!n) return 0

  const effectiveTermParent = termParent ?? electInlineTermParent(electNode, store)
  if (isSequencingTerm(effectiveTermParent, store)) {
    return n * sequenceScopeCost(electNode, store)
  }

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
