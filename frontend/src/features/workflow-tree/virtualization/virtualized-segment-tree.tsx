import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { List, type ListImperativeAPI } from '@shared/lib/virtualized-list'
import type { RowComponentProps } from '@shared/lib/virtualized-list/types'
import type { TreeState, TreeWalkerGenerator, TreeNodeCallbacks } from '../core/types'
import { computeTree } from '../core/tree-computer'
import { computeSegments, getSegmentHeight, getSegmentCount, type SegmentState } from '../segments'
import { SegmentRow, type SegmentRowProps } from '../components/segment-row'

export interface SegmentRowData extends TreeNodeCallbacks {
  segmentState: SegmentState
  rowHeight: number
  selectedId?: string
  autoEditNodeId?: string
}

export type SegmentRowComponentProps = RowComponentProps<SegmentRowData>

export const SegmentRowComponent = ({ index, rowProps }: SegmentRowComponentProps) => {
  const segment = rowProps.segmentState.segments[index]

  if (!segment) return null

  const segmentRowProps: SegmentRowProps = {
    segment,
    rowHeight: rowProps.rowHeight,
    onToggle: rowProps.onToggle,
    selectedId: rowProps.selectedId,
    onSelect: rowProps.onSelect,
    onAddChild: rowProps.onAddChild,
    onRequestDelete: rowProps.onRequestDelete,
    onDuplicateNode: rowProps.onDuplicateNode,
    onRename: rowProps.onRename,
    onRequestRename: rowProps.onRequestRename,
    autoEditNodeId: rowProps.autoEditNodeId,
  }

  return <SegmentRow {...segmentRowProps} />
}

interface VirtualizedSegmentTreeProps extends TreeNodeCallbacks {
  height: number
  rowHeight: number
  treeWalker: TreeWalkerGenerator
  width?: number | string
  overscanCount?: number
  selectedId?: string
  autoEditNodeId?: string
}

export const VirtualizedSegmentTree = ({
  height,
  rowHeight,
  treeWalker,
  width = '100%',
  overscanCount = 2,
  onToggle,
  selectedId,
  onSelect,
  onAddChild,
  onRequestDelete,
  onDuplicateNode,
  onRename,
  onRequestRename,
  autoEditNodeId,
}: VirtualizedSegmentTreeProps) => {
  const listRef = useRef<ListImperativeAPI | null>(null)
  const prevTreeWalkerRef = useRef<TreeWalkerGenerator | null>(null)

  const [treeState, setTreeState] = useState<TreeState>(() =>
    computeTree(treeWalker, { order: [], records: {} }, { refreshNodes: true }),
  )

  const [segmentState, setSegmentState] = useState<SegmentState>(() => computeSegments(treeState, { rowHeight }))

  useEffect(() => {
    if (prevTreeWalkerRef.current !== treeWalker) {
      prevTreeWalkerRef.current = treeWalker
      const newTreeState = computeTree(treeWalker, treeState, { refreshNodes: true })
      setTreeState(newTreeState)
      setSegmentState(computeSegments(newTreeState, { rowHeight }))
    }
  }, [treeWalker, treeState, rowHeight])

  const getRowHeight = useCallback((index: number) => getSegmentHeight(segmentState, index), [segmentState])

  const rowData = useMemo(
    () => ({
      segmentState,
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
    }),
    [
      segmentState,
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
    ],
  )

  /* Stable key extractor — matches segment to its primary node ID instead of index */
  const getItemKey = useCallback((index: number, props: SegmentRowData) => {
    const segment = props.segmentState.segments[index]
    if (!segment) return index
    return segment.type === 'node' ? segment.data.id : segment.parentTreeNode.id
  }, [])

  return (
    <List
      defaultHeight={height}
      itemKey={getItemKey}
      listRef={ref => {
        listRef.current = ref
      }}
      overscanCount={overscanCount}
      rowComponent={SegmentRowComponent}
      rowCount={getSegmentCount(segmentState)}
      rowHeight={getRowHeight}
      rowProps={rowData}
      style={{ width }}
    />
  )
}
