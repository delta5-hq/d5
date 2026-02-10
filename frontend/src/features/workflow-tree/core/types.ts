import type { CSSProperties } from 'react'
import type { NodeData, NodeId } from '@/shared/base-types/workflow'

export interface TreeNodeCallbacks {
  onToggle?: (id: string, sparkDelay?: number) => void
  onSelect?: (id: string) => void
  onAddChild?: (parentId: string) => void
  onRequestDelete?: (nodeId: string) => void
  onDuplicateNode?: (nodeId: string) => void
  onRename?: (nodeId: string, newTitle: string) => void
  onRequestRename?: (nodeId: string) => void
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
  /** Number of rows between this node and its parent (for wire path calculation) */
  rowsFromParent: number
  /** Cumulative animation delay (ms) — child spark starts when parent spark reaches its corner */
  sparkDelay: number
}

export interface TreeRecord {
  id: string
  data: TreeNode
  isOpen: boolean
}

export interface TreeNodeProps extends TreeRecord, TreeNodeCallbacks {
  style: CSSProperties
  isSelected?: boolean
  autoEditNodeId?: string
  wireExtendDown?: number
  wireExtendUp?: number
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
  /** Number of rows between this node and its parent */
  rowsFromParent: number
  /** Cumulative animation delay (ms) — child spark starts when parent spark reaches its corner */
  sparkDelay: number
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
