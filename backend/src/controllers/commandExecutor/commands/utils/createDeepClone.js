import {generateNodeId} from '../../../../shared/utils/generateId'

/**
 * Creates a deep clone of a node and its children
 * @param {Object} copyNode - The node to clone
 * @param {string} parentId - The ID of the new parent node
 * @param {Object.<string, Object>} allNodes - A record of all nodes
 * @returns {Object[]} An array of cloned nodes
 */
export function createDeepClone(copyNode, parentId, allNodes) {
  const clonedNodes = []
  const nodeIdMap = new Map() // Maps old node IDs to new

  function deepClone(node, parent) {
    if (!nodeIdMap.has(node.id)) {
      nodeIdMap.set(node.id, generateNodeId())
    }

    const newId = nodeIdMap.get(node.id)

    const clonedNode = {
      ...node,
      parent,
      id: newId,
      children: node.children
        ? node.children
            .map(childId => {
              if (!nodeIdMap.has(childId) && allNodes[childId]) {
                nodeIdMap.set(childId, generateNodeId())
              }
              return nodeIdMap.get(childId)
            })
            .filter(Boolean)
        : [],
      prompts: node.prompts
        ? node.prompts
            .map(promptId => {
              if (!nodeIdMap.has(promptId) && allNodes[promptId]) {
                nodeIdMap.set(promptId, generateNodeId())
              }
              return nodeIdMap.get(promptId)
            })
            .filter(Boolean)
        : [],
    }

    clonedNodes.push(clonedNode)

    node.children?.forEach(childId => {
      const childNode = allNodes[childId]

      if (childNode) {
        deepClone(childNode, newId)
      }
    })

    return clonedNode
  }

  deepClone(copyNode, parentId)
  return clonedNodes
}
