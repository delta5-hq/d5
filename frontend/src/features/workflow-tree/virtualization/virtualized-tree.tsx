import { useState, useRef, useEffect, useCallback, useMemo, memo, type ComponentType, type CSSProperties } from 'react'
import { List, type RowComponentProps, type ListImperativeAPI } from '@/shared/lib/virtualized-list'
import type { TreeState, TreeWalkerGenerator, TreeRecord } from '../core/types'
import { computeTree } from '../core/tree-computer'

export interface TreeNodeComponentProps extends TreeRecord {
  style: CSSProperties
  onToggle?: (id: string) => void
}

export interface RowData extends TreeState {
  component: ComponentType<TreeNodeComponentProps>
}

export type RowProps = RowComponentProps<RowData>

const RowComponent = ({ index, style, rowProps }: RowProps) => {
  const { component: Node, order, records } = rowProps
  const nodeId = order[index]
  return <Node {...records[nodeId]} style={style} />
}

export const Row = memo(RowComponent, (prev, next) => {
  const prevNodeId = prev.rowProps.order[prev.index]
  const nextNodeId = next.rowProps.order[next.index]

  if (prevNodeId !== nextNodeId) return false

  const prevRecord = prev.rowProps.records[prevNodeId]
  const nextRecord = next.rowProps.records[nextNodeId]
  if (prevRecord !== nextRecord) return false

  if (prev.style.transform !== next.style.transform) return false
  if (prev.style.height !== next.style.height) return false

  if (prev.rowProps.component !== next.rowProps.component) return false

  return true
})

interface VirtualizedTreeProps {
  height: number
  rowHeight: number | ((index: number) => number)
  treeWalker: TreeWalkerGenerator
  width?: number | string
  children: ComponentType<TreeNodeComponentProps>
  overscanCount?: number
}

export const VirtualizedTree = ({
  height,
  rowHeight,
  treeWalker,
  width = '100%',
  children: NodeComponent,
  overscanCount = 2,
}: VirtualizedTreeProps) => {
  const listRef = useRef<ListImperativeAPI | null>(null)
  const prevTreeWalkerRef = useRef<TreeWalkerGenerator | null>(null)

  const [state, setState] = useState<TreeState>(() =>
    computeTree(treeWalker, { order: [], records: {} }, { refreshNodes: true }),
  )

  useEffect(() => {
    if (prevTreeWalkerRef.current !== treeWalker) {
      prevTreeWalkerRef.current = treeWalker
      setState(prev => computeTree(treeWalker, prev, { refreshNodes: true }))
    }
  }, [treeWalker])

  const scrollToRow = useCallback(
    (id: string, align?: 'auto' | 'smart' | 'center' | 'end' | 'start') => {
      const index = state.order.indexOf(id)
      if (index >= 0 && listRef.current) {
        listRef.current.scrollToRow({ index, align, behavior: 'auto' })
      }
    },
    [state.order],
  )

  const rowProps = useMemo(() => ({ ...state, component: NodeComponent }), [state, NodeComponent])

  const itemKey = useCallback((index: number) => state.order[index], [state.order])

  void scrollToRow

  return (
    <List
      defaultHeight={height}
      itemKey={itemKey}
      listRef={(ref: ListImperativeAPI | null) => {
        listRef.current = ref
      }}
      overscanCount={overscanCount}
      rowComponent={Row}
      rowCount={state.order.length}
      rowHeight={rowHeight}
      rowProps={rowProps}
      style={{ width }}
    />
  )
}
