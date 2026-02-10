import type { CSSProperties } from 'react'
import type { TreeNode, TreeNodeProps } from './types'

/**
 * Only transform and height affect rendering; new object identity is ignored.
 */
export function comparePositionStyle(a: CSSProperties | undefined, b: CSSProperties | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.transform === b.transform && a.height === b.height
}

/**
 * `node` (NodeData) compared by reference — store preserves identity for unchanged nodes.
 * `ancestorContinuation` compared element-wise.
 */
export function compareTreeNodeData(a: TreeNode | undefined, b: TreeNode | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.node !== b.node) return false
  if (a.depth !== b.depth) return false
  if (a.isOpen !== b.isOpen) return false
  if (a.hasMoreSiblings !== b.hasMoreSiblings) return false
  if (a.rowsFromParent !== b.rowsFromParent) return false

  const acA = a.ancestorContinuation
  const acB = b.ancestorContinuation
  if (acA !== acB) {
    if (!acA || !acB || acA.length !== acB.length) return false
    for (let i = 0; i < acA.length; i++) {
      if (acA[i] !== acB[i]) return false
    }
  }
  return true
}

/* Every key of TreeNodeProps must appear here — grouped by comparison strategy */
type ComparedKeys =
  | 'data'
  | 'style'
  | 'autoEditNodeId'
  | 'id'
  | 'isOpen'
  | 'isSelected'
  | 'wireExtendDown'
  | 'wireExtendUp'
  | 'onToggle'
  | 'onSelect'
  | 'onAddChild'
  | 'onRequestDelete'
  | 'onDuplicateNode'
  | 'onRename'
  | 'onRequestRename'

/* Build guard: adding a prop to TreeNodeProps without listing it here errors the return type below */
type ExhaustiveCompareResult = Exclude<keyof TreeNodeProps, ComparedKeys> extends never ? boolean : never

/**
 * Explicit enumeration of all 15 TreeNodeProps keys — zero per-call allocation.
 * Return type is `ExhaustiveCompareResult`: resolves to `boolean` when ComparedKeys
 * covers every TreeNodeProps key. Adding a new prop without listing it makes the
 * return type `never`, erroring every `return` statement in this function.
 */
export function areTreeNodePropsEqual(
  prev: Readonly<TreeNodeProps>,
  next: Readonly<TreeNodeProps>,
): ExhaustiveCompareResult {
  if (!compareTreeNodeData(prev.data, next.data)) return false
  if (!comparePositionStyle(prev.style, next.style)) return false

  /* Only the node gaining/losing auto-edit status re-renders */
  if ((prev.autoEditNodeId === prev.id) !== (next.autoEditNodeId === next.id)) return false

  if (prev.id !== next.id) return false
  if (prev.isOpen !== next.isOpen) return false
  if (prev.isSelected !== next.isSelected) return false
  if (prev.wireExtendDown !== next.wireExtendDown) return false
  if (prev.wireExtendUp !== next.wireExtendUp) return false
  if (prev.onToggle !== next.onToggle) return false
  if (prev.onSelect !== next.onSelect) return false
  if (prev.onAddChild !== next.onAddChild) return false
  if (prev.onRequestDelete !== next.onRequestDelete) return false
  if (prev.onDuplicateNode !== next.onDuplicateNode) return false
  if (prev.onRename !== next.onRename) return false
  if (prev.onRequestRename !== next.onRequestRename) return false

  return true
}
