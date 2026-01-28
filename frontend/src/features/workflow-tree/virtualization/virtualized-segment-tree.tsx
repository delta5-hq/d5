import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { List, type RowComponentProps, type ListImperativeAPI } from 'react-window'
import type { TreeState, TreeWalkerGenerator } from '../core/types'
import { computeTree } from '../core/tree-computer'
import { computeSegments, getSegmentHeight, getSegmentCount, type SegmentState } from '../segments'
import { SegmentRow, type SegmentRowProps } from '../components/segment-row'

export interface SegmentRowData {
  segmentState: SegmentState
  rowHeight: number
  onToggle?: (id: string) => void
  selectedId?: string
  onSelect?: (id: string) => void
}

export type SegmentRowComponentProps = RowComponentProps<SegmentRowData>

export const SegmentRowComponent = ({ index, style, ...props }: SegmentRowComponentProps) => {
  const data = props as unknown as SegmentRowData
  const segment = data.segmentState.segments[index]

  if (!segment) return null

  /* Allow overflow for wire lines extending above/below row bounds */
  const rowStyle = { ...style, overflow: 'visible' as const }

  const segmentRowProps: SegmentRowProps = {
    segment,
    style: rowStyle,
    rowHeight: data.rowHeight,
    onToggle: data.onToggle,
    selectedId: data.selectedId,
    onSelect: data.onSelect,
  }

  return <SegmentRow {...segmentRowProps} />
}

interface VirtualizedSegmentTreeProps {
  height: number
  rowHeight: number
  treeWalker: TreeWalkerGenerator
  width?: number | string
  overscanCount?: number
  onToggle?: (id: string) => void
  selectedId?: string
  onSelect?: (id: string) => void
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

  const scrollToNode = useCallback(
    (nodeId: string, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => {
      const index = segmentState.nodeToSegmentIndex.get(nodeId)
      if (index !== undefined && listRef.current) {
        listRef.current.scrollToRow({ index, align, behavior: 'auto' })
      }
    },
    [segmentState],
  )

  const rowData = useMemo(
    () => ({
      segmentState,
      rowHeight,
      onToggle,
      selectedId,
      onSelect,
    }),
    [segmentState, rowHeight, onToggle, selectedId, onSelect],
  )

  void scrollToNode

  return (
    <List
      defaultHeight={height}
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
