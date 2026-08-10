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
  onDelete,
  onDuplicateNode,
  onRename,
  onRequestRename,
  onWrapNodes,
  onToggleChecked,
  onMoveNode,
  onDragHoverNode,
  onDragLeaveNode,
  onDragStartNode,
  onDragEndNode,
  onPointerDragStartNode,
  onDropFiles,
  activeDraggedNodeId,
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
        activeDraggedNodeId={activeDraggedNodeId}
        activeDropPosition={activeDropPosition}
        activeDropTargetId={activeDropTargetId}
        autoEditNodeId={autoEditNodeId}
        isSelected={selectedIds?.has(record.id) ?? false}
        onAddChild={onAddChild}
        onDelete={onDelete}
        onDragEndNode={onDragEndNode}
        onDragHoverNode={onDragHoverNode}
        onDragLeaveNode={onDragLeaveNode}
        onDragStartNode={onDragStartNode}
        onDropFiles={onDropFiles}
        onDuplicateNode={onDuplicateNode}
        onMoveNode={onMoveNode}
        onPointerDragStartNode={onPointerDragStartNode}
        onRename={onRename}
        onRequestRename={onRequestRename}
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
        activeDraggedNodeId={activeDraggedNodeId}
        activeDropPosition={activeDropPosition}
        activeDropTargetId={activeDropTargetId}
        autoEditNodeId={autoEditNodeId}
        container={segment}
        onAddChild={onAddChild}
        onDelete={onDelete}
        onDragEndNode={onDragEndNode}
        onDragHoverNode={onDragHoverNode}
        onDragLeaveNode={onDragLeaveNode}
        onDragStartNode={onDragStartNode}
        onDropFiles={onDropFiles}
        onDuplicateNode={onDuplicateNode}
        onMoveNode={onMoveNode}
        onPointerDragStartNode={onPointerDragStartNode}
        onRename={onRename}
        onRequestRename={onRequestRename}
        onSelect={onSelect}
        onToggle={onToggle}
        rowHeight={rowHeight}
        selectedIds={selectedIds}
      />
    )
  }

  return null
}
