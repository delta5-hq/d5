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
        isSelected={record.id === selectedId}
        onAddChild={onAddChild}
        onDuplicateNode={onDuplicateNode}
        onRequestDelete={onRequestDelete}
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
        container={segment}
        onAddChild={onAddChild}
        onDuplicateNode={onDuplicateNode}
        onRequestDelete={onRequestDelete}
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
