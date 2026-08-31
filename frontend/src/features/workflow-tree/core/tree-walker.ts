import type { NodeData } from '@/shared/base-types/workflow'
import type { FlatTreeData } from './types'
import { ROW_HEIGHT, INDENT_PER_LEVEL, WIRE_PADDING, SPARK_DURATION_MS } from './constants'
import { computeCornerArrivalMs } from './spark-delay'
import { isPromptNode } from '@entities/workflow/lib'

interface StackEntry {
  node: NodeData
  depth: number
  /** Array of booleans for each ancestor depth - true if that ancestor is NOT the last child (needs continuation line) */
  ancestorContinuation: boolean[]
  /** True if this node is NOT the last child of its parent */
  hasMoreSiblings: boolean
  /** Row index of the immediate parent */
  parentRowIndex: number
  /** Cumulative spark animation delay inherited from ancestors (ms) */
  parentSparkDelay: number
  /** True if any ancestor is a prompt (execution-generated) node - propagates generated-ness down the subtree */
  ancestorIsPrompt: boolean
}

/**
 * Generator-based tree walker for virtualized rendering.
 * Yields visible nodes lazily, handling:
 * - Circular reference detection via visited set
 * - Missing child node graceful skipping
 * - Orphan nodes (nodes without valid parent chain)
 * - Wire continuation tracking for proper tree line rendering
 * - Parent row index tracking for spark path calculation
 *
 * @param treeData - Flat tree data containing nodes, rootId, and expandedIds
 * @param refresh - If true yields TreeWalkerYield objects, else yields node IDs
 */
export function* createTreeWalker(treeData: FlatTreeData, refresh: boolean) {
  const { nodes, rootId, expandedIds } = treeData

  if (!rootId) return
  if (!nodes || Object.keys(nodes).length === 0) return

  const rootNode = nodes[rootId]
  if (!rootNode) return

  const visitedIds = new Set<string>()
  const stack: StackEntry[] = [
    {
      node: rootNode,
      depth: 0,
      ancestorContinuation: [],
      hasMoreSiblings: false,
      parentRowIndex: -1,
      parentSparkDelay: 0,
      ancestorIsPrompt: false,
    },
  ]
  let currentRowIndex = 0

  while (stack.length > 0) {
    const entry = stack.pop()
    if (!entry) continue

    const { node, depth, ancestorContinuation, hasMoreSiblings, parentRowIndex, parentSparkDelay, ancestorIsPrompt } =
      entry

    if (visitedIds.has(node.id)) continue
    visitedIds.add(node.id)

    const isRootNode = node.id === rootId
    const isOpen = expandedIds.has(node.id) || (isRootNode && node.collapsed !== true)
    const hasChildren = Boolean(node.children?.length)
    // A node is execution-generated (rendered translucent) when it is a prompt node OR when it
    // descends from one. Fan-out registers a cloned `/steps` container in its parent's prompts but
    // does not re-register the container's own cloned step children, so those children must inherit
    // the generated state from the ancestor to stay translucent like the rest of the generated subtree.
    const isPrompt = ancestorIsPrompt || isPromptNode(node.id, nodes)
    const thisRowIndex = currentRowIndex
    currentRowIndex++

    const rowsFromParent = parentRowIndex >= 0 ? thisRowIndex - parentRowIndex : 1
    const edgeDelay =
      depth > 0
        ? computeCornerArrivalMs(rowsFromParent, ROW_HEIGHT, INDENT_PER_LEVEL, WIRE_PADDING, SPARK_DURATION_MS)
        : 0
    const sparkDelay = parentSparkDelay + edgeDelay

    if (refresh) {
      yield {
        id: node.id,
        node,
        depth,
        isOpen,
        isOpenByDefault: isRootNode && node.collapsed !== true,
        hasChildren,
        isPrompt,
        ancestorContinuation,
        hasMoreSiblings,
        rowsFromParent,
        sparkDelay,
      }
    } else {
      yield node.id
    }

    if (hasChildren && isOpen) {
      const validChildren = (node.children ?? [])
        .map(childId => nodes[childId])
        .filter((childNode): childNode is NodeData => {
          if (!childNode) return false
          if (visitedIds.has(childNode.id)) return false
          return true
        })
        .reverse()

      /* Build continuation array for children: current level's continuation + this node's sibling status */
      const childAncestorContinuation = [...ancestorContinuation, hasMoreSiblings]

      validChildren.forEach((childNode, reversedIndex) => {
        /* In reversed array, index 0 is the LAST child, so hasMoreSiblings = index > 0 */
        const isLastChild = reversedIndex === 0
        stack.push({
          node: childNode,
          depth: depth + 1,
          ancestorContinuation: childAncestorContinuation,
          hasMoreSiblings: !isLastChild,
          parentRowIndex: thisRowIndex,
          parentSparkDelay: sparkDelay,
          ancestorIsPrompt: isPrompt,
        })
      })
    }
  }
}

/**
 * Return the cumulative sparkDelay of a visible node, or 0 when the node is not
 * in the walk (collapsed ancestor, missing node, or orphan). Reuses the same
 * walker so fan-out base delays match the rendered delay values exactly.
 */
export function findNodeSparkDelay(treeData: FlatTreeData, targetId: string): number {
  for (const value of createTreeWalker(treeData, true)) {
    if (typeof value !== 'string' && value.id === targetId) return value.sparkDelay
  }
  return 0
}
