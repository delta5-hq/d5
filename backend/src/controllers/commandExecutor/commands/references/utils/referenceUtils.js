import {REF_DEF_PREFIX} from '../referenceConstants'
import {referencePatterns} from './referencePatterns'

/**
 * Find a node in an array by reference
 * @param {Array} nodes - Array of nodes to search through
 * @param {boolean} checkCommandFirst - Whether to check command before title
 * @param {Function} titleOrSinglePredicate - Function to test if a title matches or a single predicate for both
 * @param {Function} [commandPredicate] - Function to test if a command matches (optional)
 * @returns {Object|undefined} The matching node or undefined
 */
export function findInNodeArray(nodes, checkCommandFirst, arg1, arg2) {
  const titlePredicate = arg1
  const commandPredicate = arg2 || arg1

  if (checkCommandFirst) {
    const withCommand = nodes.find(node => commandPredicate(node.command))
    if (withCommand) return withCommand
    return nodes.find(node => titlePredicate(node.title))
  }
  const withTitle = nodes.find(node => titlePredicate(node.title))
  if (withTitle) return withTitle
  return nodes.find(node => commandPredicate(node.command))
}

/**
 * Find a node in an object map by reference
 * @param {Object} nodeMap - Object map of nodes to search through
 * @param {boolean} checkCommandFirst - Whether to check command before title
 * @param {Function} titleOrSinglePredicate - Function to test if a title matches or a single predicate for both
 * @param {Function} [commandPredicate] - Function to test if a command matches (optional)
 * @returns {Object|undefined} The matching node or undefined
 */
export function findInNodeMap(nodeMap, checkCommandFirst, arg1, arg2) {
  const nodes = Object.values(nodeMap)
  return findInNodeArray(nodes, checkCommandFirst, arg1, arg2)
}

export function clearReferences(str, prefix = REF_DEF_PREFIX) {
  return str.replace(referencePatterns.withAssignmentPrefix(prefix), '')
}

/**
 * Extracts all references from a string with a given prefix
 * @param {string|undefined} value - The string to extract references from
 * @param {string} prefix - The prefix to look for (defaults to '@')
 * @param {string | string[]}
 * @returns {string[]} Array of references found in the string
 */
export function getReferences(value, prefix = REF_DEF_PREFIX, postfixes = '') {
  if (typeof value !== 'string') {
    return []
  }
  const matches = Array.from(value.matchAll(referencePatterns.withPrefixAndPostfixs(prefix, postfixes)))
  return matches.map(m => m[0])
}

/**
 *
 * @param {NodeData[]} nodes
 * @param {boolean} checkCommandFirst
 * @param {(titleOrCommand: string | null | undefined) => boolean} arg1
 * @param {(command: string | null | undefined) => boolean} [arg2]
 * @returns {NodeData[]}
 */
export function findAllInNodeArray(nodes, checkCommandFirst, arg1, arg2) {
  return nodes.filter(node => {
    if (checkCommandFirst) {
      return arg2?.(node.command) || arg1(node.title)
    }
    return arg1(node.title) || arg2?.(node.command)
  })
}

/**
 * Traverses up the tree from the given node, searching among sibling and descendant nodes
 * for a node that matches the given predicate functions
 *
 * @param {Node} firstNode - The starting node for the search
 * @param {Object} nodeMap - Object map of nodes to search through
 * @param {boolean} checkCommandFirst - Whether to check command before title
 * @param {(titleOrCommand: string | null | undefined) => boolean} titleOrCommandGetter - Function to test if a node title/command matches
 * @param {(command: string | null | undefined) => boolean} [commandGetter] - Function to test if a command matches
 * @returns {Node[]}
 */
export function findAllSiblingsMatch(
  firstNode,
  nodeMap,
  checkCommandFirst,
  titleOrCommandGetter,
  commandGetter,
  nodeFilter,
) {
  const visited = new Set()
  let currentNode = firstNode

  while (currentNode?.parent && nodeMap[currentNode?.parent]) {
    const parent = nodeMap[currentNode.parent]
    currentNode = parent

    const siblings = parent.children
      ? [...(parent.children ?? [])]
          .map(id => nodeMap[id])
          .filter(Boolean)
          .filter(n => !visited.has(n.id))
          .filter((n, i, arr) => arr.findIndex(m => m.id === n.id) === i)
      : []

    if (!siblings.length) continue
    const matches = findAllInNodeArray(siblings, checkCommandFirst, titleOrCommandGetter, commandGetter)

    if (matches.length > 0) {
      return matches
    }

    const childMatches = []
    const subQueue = [...siblings]

    while (subQueue.length > 0) {
      const node = subQueue.shift()

      if (visited.has(node.id)) continue
      visited.add(node.id)

      let childNodes = [...(node?.children ?? [])].map(id => nodeMap[id]).filter(Boolean)
      if (nodeFilter) {
        childNodes = childNodes.filter(x => nodeFilter(x))
      }
      subQueue.unshift(...childNodes)

      childMatches.push(...findAllInNodeArray(childNodes, checkCommandFirst, titleOrCommandGetter, commandGetter))
    }

    if (childMatches.length) {
      return childMatches
    }
  }

  return []
}
