import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidElectCell, readElectN} from './electParams'

/**
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {import('../../commands/utils/Store').default} Store
 */

/**
 * @typedef {Object} ElectEntry
 * @property {NodeData} electNode
 * @property {number} depth         - Distance from subtreeRoot (root = 0)
 * @property {number} parallelGroup - Shared by all entries at the same depth;
 *   entries in the same group are safe to evaluate concurrently
 * @property {number} n             - Parsed :n=N value
 */

/**
 * @param {NodeData} subtreeRoot
 * @param {Store} store
 * @returns {ElectEntry[]} Deepest-first so inner /elect cells resolve before
 *   outer ones observe them, keeping fork cost additive rather than multiplicative.
 */
const ElectTopology = (subtreeRoot, store) => {
  const collected = []
  collectDepthFirst(subtreeRoot, store, 0, collected)

  collected.sort((a, b) => b.depth - a.depth)

  return assignParallelGroups(collected)
}

/**
 * @param {NodeData} node
 * @param {Store} store
 * @param {number} depth
 * @param {Array} collected
 */
const collectDepthFirst = (node, store, depth, collected) => {
  if (!node) return

  const command = getNodeCommand(node)
  if (isValidElectCell(command)) {
    collected.push({electNode: node, depth, n: readElectN(command)})
  }

  for (const childId of node.children ?? []) {
    collectDepthFirst(store.getNode(childId), store, depth + 1, collected)
  }
}

/**
 * @param {Array<{electNode: NodeData, depth: number, n: number}>} sorted
 * @returns {ElectEntry[]}
 */
const assignParallelGroups = sorted => {
  const depthToGroup = new Map()
  let nextGroup = 0

  return sorted.map(entry => {
    if (!depthToGroup.has(entry.depth)) {
      depthToGroup.set(entry.depth, nextGroup++)
    }
    return {...entry, parallelGroup: depthToGroup.get(entry.depth)}
  })
}

export default ElectTopology
