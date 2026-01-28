import type { CSSProperties } from 'react'
import type { Segment } from '../segments/types'
import type { TreeRecord } from '../core/types'
import { TreeNodeDefault } from './tree-node-default'
import { ContainerRenderer } from './container-renderer'

export interface SegmentRowProps {
  segment: Segment
  style: CSSProperties
  rowHeight: number
  onToggle?: (id: string) => void
  selectedId?: string
  onSelect?: (id: string) => void
}

export const SegmentRow = ({ segment, style, rowHeight, onToggle, selectedId, onSelect }: SegmentRowProps) => {
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
