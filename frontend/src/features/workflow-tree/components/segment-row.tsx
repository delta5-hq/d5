import type { CSSProperties } from 'react'
import type { Segment } from '../segments/types'
import type { TreeRecord, TreeNodeCallbacks } from '../core/types'
import { MemoizedTreeNodeDefault } from './tree-node-default'
import { ContainerRenderer } from './container-renderer'

/* Stable identity — memo comparator short-circuits on reference equality */
const EMPTY_STYLE: CSSProperties = {}

export interface SegmentRowProps extends TreeNodeCallbacks {
  segment: Segment
  rowHeight: number
  selectedIds?: Set<string>
  autoEditNodeId?: string
}

export const SegmentRow = ({
  segment,
  rowHeight,
  onToggle,
  selectedIds,
  onSelect,
  onAddChild,
  onAddSibling,
  onDelete,
  onDuplicateNode,
  onRename,
  onWrapNodes,
  onToggleChecked,
  onDragHoverNode,
  onDragLeaveNode,
  onPointerDragStartNode,
  onDropFiles,
  activeDropTargetId,
  activeDropPosition,
  autoEditNodeId,
}: SegmentRowProps) => {
  if (segment.type === 'node') {
    const record: TreeRecord = {
      id: segment.data.id,
      data: segment.data,
      isOpen: segment.data.isOpen,
    }

    return (
      <MemoizedTreeNodeDefault
        {...record}
        activeDropPosition={activeDropPosition}
        activeDropTargetId={activeDropTargetId}
        autoEditNodeId={autoEditNodeId}
        isSelected={selectedIds?.has(record.id) ?? false}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
        onDelete={onDelete}
        onDragHoverNode={onDragHoverNode}
        onDragLeaveNode={onDragLeaveNode}
        onDropFiles={onDropFiles}
        onDuplicateNode={onDuplicateNode}
        onPointerDragStartNode={onPointerDragStartNode}
        onRename={onRename}
        onSelect={onSelect}
        onToggle={onToggle}
        onToggleChecked={onToggleChecked}
        onWrapNodes={onWrapNodes}
        style={EMPTY_STYLE}
      />
    )
  }

  if (segment.type === 'container') {
    return (
      <ContainerRenderer
        activeDropPosition={activeDropPosition}
        activeDropTargetId={activeDropTargetId}
        autoEditNodeId={autoEditNodeId}
        container={segment}
        onAddChild={onAddChild}
        onAddSibling={onAddSibling}
        onDelete={onDelete}
        onDragHoverNode={onDragHoverNode}
        onDragLeaveNode={onDragLeaveNode}
        onDropFiles={onDropFiles}
        onDuplicateNode={onDuplicateNode}
        onPointerDragStartNode={onPointerDragStartNode}
        onRename={onRename}
        onSelect={onSelect}
        onToggle={onToggle}
        onToggleChecked={onToggleChecked}
        onWrapNodes={onWrapNodes}
        rowHeight={rowHeight}
        selectedIds={selectedIds}
      />
    )
  }

  return null
}
