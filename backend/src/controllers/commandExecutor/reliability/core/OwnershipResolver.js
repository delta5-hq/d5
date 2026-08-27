import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell} from './validateParams'
import {isValidElectCell} from './electParams'
import {isRefineCell} from './refineParams'

export const UNOWNED = null

export class ValidateChildrenError extends Error {
  constructor(nodeId, childCount) {
    super(`/validate must be inline (no children): node '${nodeId}' has ${childCount} child(ren)`)
    this.name = 'ValidateChildrenError'
    this.nodeId = nodeId
  }
}

const nearestElectAncestor = (node, store) => {
  let current = store.getNode(node.parent)
  while (current) {
    if (isValidElectCell(getNodeCommand(current))) return current
    current = store.getNode(current.parent)
  }
  return null
}

const assignToOwnerMap = (validateNode, store, ownerMap) => {
  const children = validateNode.children ?? []
  if (children.length > 0) {
    throw new ValidateChildrenError(validateNode.id, children.length)
  }
  const owner = nearestElectAncestor(validateNode, store)
  const ownerId = owner ? owner.id : UNOWNED
  if (!ownerMap.has(ownerId)) ownerMap.set(ownerId, [])
  ownerMap.get(ownerId).push(validateNode)
}

const walkSubtree = (node, store, ownerMap) => {
  if (!node) return
  if (isValidateCell(getNodeCommand(node))) {
    assignToOwnerMap(node, store, ownerMap)
    return
  }
  // /refine owns its predicate children and consumes them before /elect judges
  // the resulting attempt; they must not bubble into the enclosing elect jury.
  if (isRefineCell(getNodeCommand(node))) return
  for (const childId of node.children ?? []) {
    walkSubtree(store.getNode(childId), store, ownerMap)
  }
}

const OwnershipResolver = (subtreeRoot, store) => {
  const ownerMap = new Map()
  walkSubtree(subtreeRoot, store, ownerMap)
  return ownerMap
}

export default OwnershipResolver
