import { AutoSizer } from 'react-virtualized-auto-sizer'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import { useStableCallback } from '@shared/lib/hooks'
import { useNodeCacheCleanup } from '@shared/lib/use-node-cache-cleanup'
import { VirtualizedSegmentTree } from '../virtualization/virtualized-segment-tree'
import { useTreeWalker } from '../hooks/use-tree-walker'
import { TreeAnimationProvider, useTreeAnimation } from '../context'
import { useWorkflowExpandedIds, useWorkflowActions } from '../store'
import { isCommandlessTextNode } from '@entities/workflow/lib'
import { getTreeDropPosition, type TreeDropPosition } from '../core/tree-drag'

export interface WorkflowSegmentTreeProps {
  nodes: Record<string, NodeData>
  rootId: string
  rowHeight?: number
  overscanCount?: number
  selectedIds?: Set<string>
  autoEditNodeId?: string
  onSelect?: (id: string, node: NodeData, event?: MouseEvent) => void
  onAddChild?: (parentId: string) => void
  onAddSibling?: (nodeId: string) => void
  onDelete?: (nodeId: string) => void
  onDuplicateNode?: (nodeId: string) => void
  onRename?: (nodeId: string, newTitle: string) => void
  onWrapNodes?: (nodeId: string) => void
  onMoveNode?: (nodeId: string, targetNodeId: string, position: TreeDropPosition) => void
  onDropFiles?: (parentId: string, files: FileList) => void
  onVisibleOrderChange?: (order: readonly string[]) => void
  /** Newly created node ID — signals the tree to flash it on mount */
  flashNodeId?: string
  /** When true, each node renders an inline checkbox reflecting node.checked */
  showCheckboxes?: boolean
}

const WorkflowSegmentTreeInner = ({
  nodes,
  rootId,
  rowHeight = 48,
  overscanCount = 5,
  selectedIds,
  autoEditNodeId,
  onSelect,
  onAddChild,
  onAddSibling,
  onDelete,
  onDuplicateNode,
  onRename,
  onWrapNodes,
  onMoveNode,
  onDropFiles,
  onVisibleOrderChange,
  flashNodeId,
  showCheckboxes,
}: WorkflowSegmentTreeProps) => {
  const nodeIds = useMemo(() => new Set(Object.keys(nodes)), [nodes])
  useNodeCacheCleanup(nodeIds)

  const expandedIds = useWorkflowExpandedIds()
  const { toggleExpanded, expandNode, toggleChecked, persistNow } = useWorkflowActions()
  const treeWalker = useTreeWalker({ nodes, rootId, expandedIds })
  const { scheduleNewNodeFlash } = useTreeAnimation()
  const hoverExpansionTimerRef = useRef<number | null>(null)
  const hoverExpansionNodeIdRef = useRef<string | null>(null)
  const pointerDragRef = useRef<{
    nodeId: string
    pointerId: number
    startX: number
    startY: number
    targetId?: string
    position?: TreeDropPosition
    dragging: boolean
  } | null>(null)
  const [activePointerDrop, setActivePointerDrop] = useState<
    { targetId: string; position: TreeDropPosition } | undefined
  >()

  const cancelHoverExpansion = useCallback(() => {
    if (hoverExpansionTimerRef.current) {
      window.clearTimeout(hoverExpansionTimerRef.current)
      hoverExpansionTimerRef.current = null
    }
    hoverExpansionNodeIdRef.current = null
  }, [])

  useEffect(() => cancelHoverExpansion, [cancelHoverExpansion])

  useEffect(() => {
    if (flashNodeId) scheduleNewNodeFlash(flashNodeId)
  }, [flashNodeId, scheduleNewNodeFlash])

  const handleSelect = useStableCallback((id: string, event?: MouseEvent) => {
    const node = nodes[id]
    if (node && onSelect) {
      onSelect(id, node, event)
    }
  })

  const handleToggle = useStableCallback((id: string) => {
    toggleExpanded(id)
  })

  const handleToggleChecked = useStableCallback((nodeId: string) => {
    const node = nodes[nodeId]
    if (!node) return
    toggleChecked(nodeId)
    void persistNow()
  })

  const handleAddChild = useCallback(
    (parentId: string) => {
      expandNode(parentId)
      onAddChild?.(parentId)
    },
    [expandNode, onAddChild],
  )

  const handleDragHoverNode = useStableCallback((nodeId: string) => {
    if (hoverExpansionNodeIdRef.current === nodeId) return
    cancelHoverExpansion()
    hoverExpansionNodeIdRef.current = nodeId
    hoverExpansionTimerRef.current = window.setTimeout(() => {
      hoverExpansionTimerRef.current = null
      hoverExpansionNodeIdRef.current = null
      const node = nodes[nodeId]
      const canExpand = node && ((node.children?.length ?? 0) > 0 || isCommandlessTextNode(node))
      if (canExpand && !expandedIds.has(nodeId)) toggleExpanded(nodeId)
    }, 600)
  })

  const updatePointerDropTarget = useStableCallback((clientX: number, clientY: number) => {
    const active = pointerDragRef.current
    if (!active) return

    const rowElement = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-node-id]')
    const targetId = rowElement?.dataset.nodeId
    if (!rowElement || !targetId || targetId === active.nodeId) {
      active.targetId = undefined
      active.position = undefined
      setActivePointerDrop(undefined)
      cancelHoverExpansion()
      return
    }

    const position = getTreeDropPosition(clientY, rowElement.getBoundingClientRect())
    active.targetId = targetId
    active.position = position
    if (!nodes[active.nodeId]) {
      setActivePointerDrop(undefined)
      return
    }
    setActivePointerDrop({ targetId, position })
    if (position === 'inside') handleDragHoverNode(targetId)
    else cancelHoverExpansion()
  })

  const resetPointerDrag = useStableCallback(() => {
    pointerDragRef.current = null
    setActivePointerDrop(undefined)
    cancelHoverExpansion()
  })

  const handlePointerMove = useStableCallback((event: globalThis.PointerEvent) => {
    const active = pointerDragRef.current
    if (!active || event.pointerId !== active.pointerId) return

    const movedX = Math.abs(event.clientX - active.startX)
    const movedY = Math.abs(event.clientY - active.startY)
    if (!active.dragging && Math.max(movedX, movedY) < 4) return

    active.dragging = true
    updatePointerDropTarget(event.clientX, event.clientY)
    event.preventDefault()
  })

  const handlePointerUp = useStableCallback((event: globalThis.PointerEvent) => {
    const active = pointerDragRef.current
    if (!active || event.pointerId !== active.pointerId) return

    const { nodeId, targetId, position, dragging } = active
    resetPointerDrag()
    if (dragging && targetId && position) onMoveNode?.(nodeId, targetId, position)
  })

  const handlePointerDragStartNode = useStableCallback(
    (nodeId: string, event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
      if (pointerDragRef.current) return
      pointerDragRef.current = {
        nodeId,
        pointerId: 'pointerId' in event ? event.pointerId : -1,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      }
    },
  )

  const handleMouseMove = useStableCallback((event: globalThis.MouseEvent) => {
    const active = pointerDragRef.current
    if (!active || active.pointerId !== -1) return

    const movedX = Math.abs(event.clientX - active.startX)
    const movedY = Math.abs(event.clientY - active.startY)
    if (!active.dragging && Math.max(movedX, movedY) < 4) return

    active.dragging = true
    updatePointerDropTarget(event.clientX, event.clientY)
    event.preventDefault()
  })

  const handleMouseUp = useStableCallback((event: globalThis.MouseEvent) => {
    const active = pointerDragRef.current
    if (!active || active.pointerId !== -1) return

    const { nodeId, targetId, position, dragging } = active
    resetPointerDrag()
    if (dragging && targetId && position) onMoveNode?.(nodeId, targetId, position)
    event.preventDefault()
  })

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', resetPointerDrag)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', resetPointerDrag)
    }
  }, [handleMouseMove, handleMouseUp, handlePointerMove, handlePointerUp, resetPointerDrag])

  return (
    <div className="h-full w-full">
      <AutoSizer
        renderProp={({ height, width }) =>
          height && width ? (
            <VirtualizedSegmentTree
              activeDropPosition={activePointerDrop?.position}
              activeDropTargetId={activePointerDrop?.targetId}
              autoEditNodeId={autoEditNodeId}
              height={height}
              onAddChild={handleAddChild}
              onAddSibling={onAddSibling}
              onDelete={onDelete}
              onDragHoverNode={handleDragHoverNode}
              onDragLeaveNode={cancelHoverExpansion}
              onDropFiles={onDropFiles}
              onDuplicateNode={onDuplicateNode}
              onPointerDragStartNode={handlePointerDragStartNode}
              onRename={onRename}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onToggleChecked={showCheckboxes ? handleToggleChecked : undefined}
              onVisibleOrderChange={onVisibleOrderChange}
              onWrapNodes={onWrapNodes}
              overscanCount={overscanCount}
              rootId={rootId}
              rowHeight={rowHeight}
              selectedIds={selectedIds}
              treeWalker={treeWalker}
              width={width}
            />
          ) : null
        }
      />
    </div>
  )
}

export const WorkflowSegmentTree = (props: WorkflowSegmentTreeProps) => (
  <TreeAnimationProvider>
    <WorkflowSegmentTreeInner {...props} />
  </TreeAnimationProvider>
)
