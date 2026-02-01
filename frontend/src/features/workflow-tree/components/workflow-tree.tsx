import { AutoSizer } from 'react-virtualized-auto-sizer'
import { useCallback, type ComponentType } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import { VirtualizedTree, type TreeNodeComponentProps } from '../virtualization/virtualized-tree'
import { useTreeWalker } from '../hooks/use-tree-walker'
import { useTreeExpansion } from '../hooks/use-tree-expansion'
import { TreeAnimationProvider, useTreeAnimation } from '../context'
import { TreeNodeDefault } from './tree-node-default'
import type { TreeNodeProps } from './tree-node-default'

export interface WorkflowTreeProps {
  nodes: Record<string, NodeData>
  rootId: string
  rowHeight?: number
  initialExpandedIds?: Set<string>
  nodeComponent?: ComponentType<TreeNodeProps>
  overscanCount?: number
  selectedId?: string
  onSelect?: (id: string, node: NodeData) => void
}

/** Collect all descendant IDs recursively */
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

/** Inner component that uses animation context */
const WorkflowTreeInner = ({
  nodes,
  rootId,
  rowHeight = 48,
  initialExpandedIds,
  nodeComponent,
  overscanCount = 5,
  selectedId,
  onSelect,
}: WorkflowTreeProps) => {
  const { expandedIds, toggleNode } = useTreeExpansion(initialExpandedIds)
  const treeWalker = useTreeWalker({ nodes, rootId, expandedIds })
  const { scheduleAnimation } = useTreeAnimation()

  const NodeComponent = nodeComponent || TreeNodeDefault

  const handleSelect = useCallback(
    (id: string) => {
      const node = nodes[id]
      if (node && onSelect) {
        onSelect(id, node)
      }
    },
    [nodes, onSelect],
  )

  /* Toggle with animation scheduling for descendants */
  const handleToggle = useCallback(
    (id: string) => {
      const wasExpanded = expandedIds.has(id)

      /* If expanding, schedule animations for all descendants */
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

  const NodeWrapper = useCallback(
    (props: TreeNodeComponentProps) => (
      <NodeComponent
        {...(props as unknown as TreeNodeProps)}
        isSelected={props.id === selectedId}
        onSelect={handleSelect}
        onToggle={handleToggle}
      />
    ),
    [NodeComponent, handleToggle, selectedId, handleSelect],
  )

  return (
    <div className="h-full w-full">
      <AutoSizer
        renderProp={({ height, width }) =>
          height && width ? (
            <VirtualizedTree
              height={height}
              overscanCount={overscanCount}
              rowHeight={rowHeight}
              treeWalker={treeWalker}
              width={width}
            >
              {NodeWrapper}
            </VirtualizedTree>
          ) : null
        }
      />
    </div>
  )
}

export const WorkflowTree = (props: WorkflowTreeProps) => (
  <TreeAnimationProvider>
    <WorkflowTreeInner {...props} />
  </TreeAnimationProvider>
)
