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
  selectedIds?: Set<string>
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
    selectedIds: rowProps.selectedIds,
    onSelect: rowProps.onSelect,
    onAddChild: rowProps.onAddChild,
    onDelete: rowProps.onDelete,
    onDuplicateNode: rowProps.onDuplicateNode,
    onRename: rowProps.onRename,
    onRequestRename: rowProps.onRequestRename,
    onWrapNodes: rowProps.onWrapNodes,
    onToggleChecked: rowProps.onToggleChecked,
    onDragHoverNode: rowProps.onDragHoverNode,
    onDragLeaveNode: rowProps.onDragLeaveNode,
    onPointerDragStartNode: rowProps.onPointerDragStartNode,
    onDropFiles: rowProps.onDropFiles,
    activeDropTargetId: rowProps.activeDropTargetId,
    activeDropPosition: rowProps.activeDropPosition,
    dragSourceNode: rowProps.dragSourceNode,
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
  selectedIds?: Set<string>
  autoEditNodeId?: string
  /** Root node ID to render outside the list; its descendants stay in place. */
  rootId?: string
  onVisibleOrderChange?: (order: readonly string[]) => void
}

export const VirtualizedSegmentTree = ({
  height,
  rowHeight,
  treeWalker,
  width = '100%',
  overscanCount = 2,
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
  onDragHoverNode,
  onDragLeaveNode,
  onPointerDragStartNode,
  onDropFiles,
  activeDropTargetId,
  activeDropPosition,
  dragSourceNode,
  autoEditNodeId,
  rootId,
  onVisibleOrderChange,
}: VirtualizedSegmentTreeProps) => {
  const listRef = useRef<ListImperativeAPI | null>(null)
  const prevTreeWalkerRef = useRef<TreeWalkerGenerator | null>(null)

  const [treeState, setTreeState] = useState<TreeState>(() =>
    computeTree(treeWalker, { order: [], records: {} }, { refreshNodes: true }),
  )

  const [segmentState, setSegmentState] = useState<SegmentState>(() =>
    computeSegments(treeState, { rowHeight, excludeRootId: rootId }),
  )

  useEffect(() => {
    if (prevTreeWalkerRef.current !== treeWalker) {
      prevTreeWalkerRef.current = treeWalker
      const newTreeState = computeTree(treeWalker, treeState, { refreshNodes: true })
      setTreeState(newTreeState)
      setSegmentState(computeSegments(newTreeState, { rowHeight, excludeRootId: rootId }))
    }
  }, [treeWalker, treeState, rowHeight, rootId])

  useEffect(() => {
    onVisibleOrderChange?.(treeState.order)
  }, [treeState.order, onVisibleOrderChange])

  const getRowHeight = useCallback((index: number) => getSegmentHeight(segmentState, index), [segmentState])

  const rowData = useMemo(
    () => ({
      segmentState,
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
      onDragHoverNode,
      onDragLeaveNode,
      onPointerDragStartNode,
      onDropFiles,
      activeDropTargetId,
      activeDropPosition,
      dragSourceNode,
      autoEditNodeId,
    }),
    [
      segmentState,
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
      onDragHoverNode,
      onDragLeaveNode,
      onPointerDragStartNode,
      onDropFiles,
      activeDropTargetId,
      activeDropPosition,
      dragSourceNode,
      autoEditNodeId,
    ],
  )

  /* Stable React keys — node ID instead of positional index */
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
