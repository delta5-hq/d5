import type { NodeData } from '@/shared/base-types/workflow'
import type { FlatTreeData } from './types'

interface StackEntry {
  node: NodeData
  depth: number
  /** Array of booleans for each ancestor depth - true if that ancestor is NOT the last child (needs continuation line) */
  ancestorContinuation: boolean[]
  /** True if this node is NOT the last child of its parent */
  hasMoreSiblings: boolean
}

/**
 * Generator-based tree walker for virtualized rendering.
 * Yields visible nodes lazily, handling:
 * - Circular reference detection via visited set
 * - Missing child node graceful skipping
 * - Orphan nodes (nodes without valid parent chain)
 * - Wire continuation tracking for proper tree line rendering
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
  const stack: StackEntry[] = [{ node: rootNode, depth: 0, ancestorContinuation: [], hasMoreSiblings: false }]

  while (stack.length > 0) {
    const entry = stack.pop()
    if (!entry) continue

    const { node, depth, ancestorContinuation, hasMoreSiblings } = entry

    if (visitedIds.has(node.id)) continue
    visitedIds.add(node.id)

    const isRootNode = node.id === rootId
    const isOpen = isRootNode || expandedIds.has(node.id)
    const hasChildren = Boolean(node.children?.length)

    if (refresh) {
      yield {
        id: node.id,
        node,
        depth,
        isOpen,
        isOpenByDefault: isRootNode,
        hasChildren,
        /** Wire continuation: at each ancestor depth, does that level need a vertical continuation line? */
        ancestorContinuation,
        /** Does this node have more siblings after it? (should extend vertical line below) */
        hasMoreSiblings,
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
        })
      })
    }
  }
}
