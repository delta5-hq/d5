import { useState, useRef, useEffect, useCallback, useMemo, type ComponentType, type CSSProperties } from 'react'
import { List, type RowComponentProps, type ListImperativeAPI } from 'react-window'
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

export const Row = ({ index, style, ...props }: RowProps) => {
  const data = props as unknown as RowData
  const { component: Node, order, records } = data
  return <Node {...records[order[index]]} style={style} />
}

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

  void scrollToRow

  return (
    <List
      defaultHeight={height}
      listRef={ref => {
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
