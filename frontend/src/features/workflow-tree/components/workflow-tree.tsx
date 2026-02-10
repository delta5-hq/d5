import { AutoSizer } from 'react-virtualized-auto-sizer'
import { useCallback, useMemo, type ComponentType } from 'react'
import type { NodeData } from '@/shared/base-types/workflow'
import { useNodeCacheCleanup } from '@shared/lib/use-node-cache-cleanup'
import { VirtualizedTree, type TreeNodeComponentProps } from '../virtualization/virtualized-tree'
import { useTreeWalker } from '../hooks/use-tree-walker'
import { useTreeExpansion } from '../hooks/use-tree-expansion'
import { useAnimatedToggle } from '../hooks/use-animated-toggle'
import { TreeAnimationProvider } from '../context'
import { MemoizedTreeNodeDefault } from './tree-node-default'
import type { TreeNodeProps } from '../core/types'

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
  const nodeIds = useMemo(() => new Set(Object.keys(nodes)), [nodes])
  useNodeCacheCleanup(nodeIds)

  const { expandedIds, toggleNode } = useTreeExpansion(initialExpandedIds)
  const treeWalker = useTreeWalker({ nodes, rootId, expandedIds })

  const NodeComponent = nodeComponent || MemoizedTreeNodeDefault

  const handleSelect = useCallback(
    (id: string) => {
      const node = nodes[id]
      if (node && onSelect) {
        onSelect(id, node)
      }
    },
    [nodes, onSelect],
  )

  const handleToggle = useAnimatedToggle(nodes, expandedIds, toggleNode)

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
