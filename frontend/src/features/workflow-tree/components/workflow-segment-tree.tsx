import { AutoSizer } from 'react-virtualized-auto-sizer'
import { useCallback, useEffect, useMemo, type MouseEvent } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import { useStableCallback } from '@shared/lib/hooks'
import { useNodeCacheCleanup } from '@shared/lib/use-node-cache-cleanup'
import { VirtualizedSegmentTree } from '../virtualization/virtualized-segment-tree'
import { useTreeWalker } from '../hooks/use-tree-walker'
import { useAnimatedToggle } from '../hooks/use-animated-toggle'
import { TreeAnimationProvider, useTreeAnimation } from '../context'
import { useWorkflowExpandedIds, useWorkflowActions } from '../store'

export interface WorkflowSegmentTreeProps {
  nodes: Record<string, NodeData>
  rootId: string
  rowHeight?: number
  overscanCount?: number
  selectedIds?: Set<string>
  autoEditNodeId?: string
  onSelect?: (id: string, node: NodeData, event?: MouseEvent) => void
  onAddChild?: (parentId: string) => void
  onDelete?: (nodeId: string) => void
  onDuplicateNode?: (nodeId: string) => void
  onRename?: (nodeId: string, newTitle: string) => void
  onRequestRename?: (nodeId: string) => void
  onVisibleOrderChange?: (order: readonly string[]) => void
  /** Newly created node ID — signals the tree to flash it on mount */
  flashNodeId?: string
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
  onDelete,
  onDuplicateNode,
  onRename,
  onRequestRename,
  onVisibleOrderChange,
  flashNodeId,
}: WorkflowSegmentTreeProps) => {
  const nodeIds = useMemo(() => new Set(Object.keys(nodes)), [nodes])
  useNodeCacheCleanup(nodeIds)

  const expandedIds = useWorkflowExpandedIds()
  const { toggleExpanded, expandNode } = useWorkflowActions()
  const treeWalker = useTreeWalker({ nodes, rootId, expandedIds })
  const { scheduleNewNodeFlash } = useTreeAnimation()

  useEffect(() => {
    if (flashNodeId) scheduleNewNodeFlash(flashNodeId)
  }, [flashNodeId, scheduleNewNodeFlash])

  const handleSelect = useStableCallback((id: string, event?: MouseEvent) => {
    const node = nodes[id]
    if (node && onSelect) {
      onSelect(id, node, event)
    }
  })

  const handleToggle = useAnimatedToggle(nodes, expandedIds, toggleExpanded)

  const handleAddChild = useCallback(
    (parentId: string) => {
      expandNode(parentId)
      onAddChild?.(parentId)
    },
    [expandNode, onAddChild],
  )

  return (
    <div className="h-full w-full">
      <AutoSizer
        renderProp={({ height, width }) =>
          height && width ? (
            <VirtualizedSegmentTree
              autoEditNodeId={autoEditNodeId}
              height={height}
              onAddChild={handleAddChild}
              onDelete={onDelete}
              onDuplicateNode={onDuplicateNode}
              onRename={onRename}
              onRequestRename={onRequestRename}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onVisibleOrderChange={onVisibleOrderChange}
              overscanCount={overscanCount}
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
