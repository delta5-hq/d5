import type { NodeData, NodeId } from '@/shared/base-types/workflow'

export interface TreeNodeCallbacks {
  onToggle?: (id: string) => void
  onSelect?: (id: string) => void
  onAddChild?: (parentId: string) => void
  onRequestDelete?: (nodeId: string) => void
  onDuplicateNode?: (nodeId: string) => void
}

export interface TreeNode {
  id: string
  node: NodeData
  depth: number
  isOpen: boolean
  isOpenByDefault: boolean
  hasChildren: boolean
  /** Wire continuation: at each ancestor depth, does that level need a vertical continuation line? */
  ancestorContinuation: boolean[]
  /** Does this node have more siblings after it? (should extend vertical line below) */
  hasMoreSiblings: boolean
  /** Row index of the immediate parent node (for calculating spark path length) */
  parentRowIndex: number
}

export interface TreeRecord {
  id: string
  data: TreeNode
  isOpen: boolean
}

export interface TreeState {
  order: string[]
  records: Record<string, TreeRecord>
}

export interface TreeWalkerYield {
  id: string
  node: NodeData
  depth: number
  isOpen: boolean
  isOpenByDefault: boolean
  hasChildren: boolean
  /** Wire continuation: at each ancestor depth, does that level need a vertical continuation line? */
  ancestorContinuation: boolean[]
  /** Does this node have more siblings after it? (should extend vertical line below) */
  hasMoreSiblings: boolean
  /** Row index of the immediate parent node */
  parentRowIndex: number
}

export type TreeWalkerGenerator = (refresh: boolean) => ReturnType<typeof import('./tree-walker').createTreeWalker>

export interface TreeComputeOptions {
  refreshNodes?: boolean
}

export interface FlatTreeData {
  nodes: Record<string, NodeData>
  rootId: string
  expandedIds: Set<string>
}

export interface ExpansionSource {
  type: 'explicit' | 'fromData'
  explicitIds?: Set<string>
}

export type CollapsedStateResolver = (node: NodeData, rootId: NodeId) => boolean

export const defaultCollapsedResolver: CollapsedStateResolver = (node, rootId) => {
  if (node.id === rootId) return false
  return node.collapsed === true
}

export const allExpandedResolver: CollapsedStateResolver = () => false

export const allCollapsedResolver: CollapsedStateResolver = (node, rootId) => node.id !== rootId
