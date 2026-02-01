import { AutoSizer } from 'react-virtualized-auto-sizer'
import { useCallback } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
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
  onSelect?: (id: string, node: NodeData) => void
}

function collectDescendantIds(nodeId: string, nodes: Record<string, NodeData>): string[] {
  const node = nodes[nodeId]
  if (!node?.children?.length) return []

  const descendants: string[] = []
  const stack = [...node.children]

  while (stack.length > 0) {
    const childId = stack.pop()!
    descendants.push(childId)
    const childNode = nodes[childId]
    if (childNode?.children?.length) {
      stack.push(...childNode.children)
    }
  }

  return descendants
}

const WorkflowSegmentTreeInner = ({
  nodes,
  rootId,
  rowHeight = 48,
  initialExpandedIds,
  overscanCount = 5,
  selectedId,
  onSelect,
}: WorkflowSegmentTreeProps) => {
  const { expandedIds, toggleNode } = useTreeExpansion(initialExpandedIds)
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
        const descendantIds = collectDescendantIds(id, nodes)
        if (descendantIds.length > 0) {
          scheduleAnimation(descendantIds)
        }
      }

      toggleNode(id)
    },
    [expandedIds, nodes, scheduleAnimation, toggleNode],
  )

  return (
    <div className="h-full w-full">
      <AutoSizer
        renderProp={({ height, width }) =>
          height && width ? (
            <VirtualizedSegmentTree
              height={height}
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
