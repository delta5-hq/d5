import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react'
import { List, type ListImperativeAPI } from '@shared/lib/virtualized-list'
import type { RowComponentProps } from '@shared/lib/virtualized-list/types'
import type { TreeState, TreeWalkerGenerator, TreeNodeCallbacks } from '../core/types'
import { computeTree } from '../core/tree-computer'
import { computeSegments, getSegmentHeight, getSegmentCount, type SegmentState } from '../segments'
import { SegmentRow, type SegmentRowProps } from '../components/segment-row'
import { useTreeAnimation } from '../context'

export interface SegmentRowData extends TreeNodeCallbacks {
  segmentState: SegmentState
  rowHeight: number
  selectedIds?: Set<string>
  autoEditNodeId?: string
}

export type SegmentRowComponentProps = RowComponentProps<SegmentRowData>

export function getAnimationScrollTargetIndex(
  segmentState: SegmentState,
  pendingNodeIds: readonly string[],
): number | undefined {
  let lastTargetIndex: number | undefined

  for (const nodeId of pendingNodeIds) {
    const index = segmentState.nodeToSegmentIndex.get(nodeId)
    if (index !== undefined && (lastTargetIndex === undefined || index > lastTargetIndex)) {
      lastTargetIndex = index
    }
  }

  return lastTargetIndex
}

export function getAnimationResultScrollTargetIndex(
  treeState: TreeState,
  segmentState: SegmentState,
  animationTargetNodeIds: readonly string[],
): number | undefined {
  for (let targetIndex = animationTargetNodeIds.length - 1; targetIndex >= 0; targetIndex--) {
    const target = treeState.records[animationTargetNodeIds[targetIndex]]?.data
    if (!target?.isOpen) continue

    const resultNodeIds = target.node.children ?? []
    for (let resultIndex = resultNodeIds.length - 1; resultIndex >= 0; resultIndex--) {
      const segmentIndex = segmentState.nodeToSegmentIndex.get(resultNodeIds[resultIndex])
      if (segmentIndex !== undefined) return segmentIndex
    }
  }

  return undefined
}

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
    onAddSibling: rowProps.onAddSibling,
    onDelete: rowProps.onDelete,
    onDuplicateNode: rowProps.onDuplicateNode,
    onRename: rowProps.onRename,
    onWrapNodes: rowProps.onWrapNodes,
    onToggleChecked: rowProps.onToggleChecked,
    onDragHoverNode: rowProps.onDragHoverNode,
    onDragLeaveNode: rowProps.onDragLeaveNode,
    onPointerDragStartNode: rowProps.onPointerDragStartNode,
    onDropFiles: rowProps.onDropFiles,
    activeDropTargetId: rowProps.activeDropTargetId,
    activeDropPosition: rowProps.activeDropPosition,
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
  rootId,
  onVisibleOrderChange,
}: VirtualizedSegmentTreeProps) => {
  const listRef = useRef<ListImperativeAPI | null>(null)
  const prevTreeWalkerRef = useRef<TreeWalkerGenerator | null>(null)
  const animationTargetNodeIdsRef = useRef<readonly string[]>([])
  const { animationVersion, getPendingNodeIds } = useTreeAnimation()

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

  useLayoutEffect(() => {
    const pendingNodeIds = getPendingNodeIds()
    if (pendingNodeIds.length > 0) animationTargetNodeIdsRef.current = pendingNodeIds

    const targetIndex = getAnimationScrollTargetIndex(segmentState, pendingNodeIds)
    if (targetIndex !== undefined) {
      listRef.current?.scrollToRow({ index: targetIndex, align: 'end', behavior: 'auto' })
      return
    }

    const resultIndex = getAnimationResultScrollTargetIndex(treeState, segmentState, animationTargetNodeIdsRef.current)
    if (resultIndex !== undefined) {
      listRef.current?.scrollToRow({ index: resultIndex, align: 'end', behavior: 'auto' })
      animationTargetNodeIdsRef.current = []
    }
  }, [animationVersion, treeState, segmentState, getPendingNodeIds])

  const getRowHeight = useCallback((index: number) => getSegmentHeight(segmentState, index), [segmentState])

  const rowData = useMemo(
    () => ({
      segmentState,
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
    }),
    [
      segmentState,
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
