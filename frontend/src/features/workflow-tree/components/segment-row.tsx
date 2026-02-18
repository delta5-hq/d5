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
  onRequestDelete,
  onDirectDelete,
  onDuplicateNode,
  onRename,
  onRequestRename,
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
        autoEditNodeId={autoEditNodeId}
        isSelected={selectedIds?.has(record.id) ?? false}
        onAddChild={onAddChild}
        onDirectDelete={onDirectDelete}
        onDuplicateNode={onDuplicateNode}
        onRename={onRename}
        onRequestDelete={onRequestDelete}
        onRequestRename={onRequestRename}
        onSelect={onSelect}
        onToggle={onToggle}
        style={EMPTY_STYLE}
      />
    )
  }

  if (segment.type === 'container') {
    return (
      <ContainerRenderer
        autoEditNodeId={autoEditNodeId}
        container={segment}
        onAddChild={onAddChild}
        onDirectDelete={onDirectDelete}
        onDuplicateNode={onDuplicateNode}
        onRename={onRename}
        onRequestDelete={onRequestDelete}
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
