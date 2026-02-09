import { AutoSizer } from 'react-virtualized-auto-sizer'
import { useCallback, useMemo } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import { getDescendantIds } from '@entities/workflow/lib'
import { useNodeCacheCleanup } from '@shared/lib/use-node-cache-cleanup'
import { VirtualizedSegmentTree } from '../virtualization/virtualized-segment-tree'
import { useTreeWalker } from '../hooks/use-tree-walker'
import { useTreeExpansion } from '../hooks/use-tree-expansion'
import { TreeAnimationProvider, useTreeAnimation } from '../context'

export interface WorkflowSegmentTreeProps {
  nodes: Record<string, NodeData>
  rootId: string
  rowHeight?: number
  initialExpandedIds?: Set<string>
  overscanCount?: number
  selectedId?: string
  autoEditNodeId?: string
  onSelect?: (id: string, node: NodeData) => void
  onAddChild?: (parentId: string) => void
  onRequestDelete?: (nodeId: string) => void
  onDuplicateNode?: (nodeId: string) => void
  onRename?: (nodeId: string, newTitle: string) => void
  onRequestRename?: (nodeId: string) => void
}

const WorkflowSegmentTreeInner = ({
  nodes,
  rootId,
  rowHeight = 48,
  initialExpandedIds,
  overscanCount = 5,
  selectedId,
  autoEditNodeId,
  onSelect,
  onAddChild,
  onRequestDelete,
  onDuplicateNode,
  onRename,
  onRequestRename,
}: WorkflowSegmentTreeProps) => {
  const nodeIds = useMemo(() => new Set(Object.keys(nodes)), [nodes])
  useNodeCacheCleanup(nodeIds)

  const { expandedIds, toggleNode, expandNode } = useTreeExpansion(initialExpandedIds)
  const treeWalker = useTreeWalker({ nodes, rootId, expandedIds })
  const { scheduleAnimation } = useTreeAnimation()

  const handleSelect = useCallback(
    (id: string) => {
      const node = nodes[id]
      if (node && onSelect) {
        onSelect(id, node)
      }
    },
    [nodes, onSelect],
  )

  const handleToggle = useCallback(
    (id: string) => {
      const wasExpanded = expandedIds.has(id)

      if (!wasExpanded) {
        const descendantIds = getDescendantIds(nodes, id)
        if (descendantIds.length > 0) {
          scheduleAnimation(descendantIds)
        }
      }

      toggleNode(id)
    },
    [expandedIds, nodes, scheduleAnimation, toggleNode],
  )

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
              onDuplicateNode={onDuplicateNode}
              onRename={onRename}
              onRequestDelete={onRequestDelete}
              onRequestRename={onRequestRename}
              onSelect={handleSelect}
              onToggle={handleToggle}
              overscanCount={overscanCount}
              rowHeight={rowHeight}
              selectedId={selectedId}
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
