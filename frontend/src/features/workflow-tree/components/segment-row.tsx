import type { CSSProperties } from 'react'
import type { Segment } from '../segments/types'
import type { TreeRecord, TreeNodeCallbacks } from '../core/types'
import { TreeNodeDefault } from './tree-node-default'
import { ContainerRenderer } from './container-renderer'

export interface SegmentRowProps extends TreeNodeCallbacks {
  segment: Segment
  style: CSSProperties
  rowHeight: number
  selectedId?: string
  autoEditNodeId?: string
}

export const SegmentRow = ({
  segment,
  style,
  rowHeight,
  onToggle,
  selectedId,
  onSelect,
  onAddChild,
  onRequestDelete,
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
      <TreeNodeDefault
        {...record}
        autoEditNodeId={autoEditNodeId}
        isSelected={record.id === selectedId}
        onAddChild={onAddChild}
        onDuplicateNode={onDuplicateNode}
        onRename={onRename}
        onRequestDelete={onRequestDelete}
        onRequestRename={onRequestRename}
        onSelect={onSelect}
        onToggle={onToggle}
        rowIndex={segment.rowIndex}
        style={style}
      />
    )
  }

  if (segment.type === 'container') {
    return (
      <ContainerRenderer
        autoEditNodeId={autoEditNodeId}
        container={segment}
        onAddChild={onAddChild}
        onDuplicateNode={onDuplicateNode}
        onRename={onRename}
        onRequestDelete={onRequestDelete}
        onRequestRename={onRequestRename}
        onSelect={onSelect}
        onToggle={onToggle}
        rowHeight={rowHeight}
        selectedId={selectedId}
        style={style}
      />
    )
  }

  return null
}
