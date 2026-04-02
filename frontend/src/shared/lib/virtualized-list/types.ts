import type { CSSProperties, ReactNode } from 'react'

export type ScrollAlign = 'auto' | 'center' | 'end' | 'smart' | 'start'
export type ScrollBehavior = 'auto' | 'instant' | 'smooth'

export interface RowComponentProps<RowProps extends object = object> {
  index: number
  rowProps: RowProps
}

export interface ListImperativeAPI {
  readonly element: HTMLDivElement | null
  scrollToRow: (config: { align?: ScrollAlign; behavior?: ScrollBehavior; index: number }) => void
}

export interface VisibleRange {
  startIndex: number
  stopIndex: number
}

export interface ListProps<RowProps extends object> {
  className?: string
  defaultHeight: number
  listRef?: (ref: ListImperativeAPI | null) => void
  onRowsRendered?: (visibleRows: VisibleRange, allRows: VisibleRange) => void
  overscanCount?: number
  rowComponent: (props: RowComponentProps<RowProps>) => ReactNode
  rowCount: number
  rowHeight: number | ((index: number, rowProps: RowProps) => number)
  rowProps: RowProps
  style?: CSSProperties
  itemKey?: (index: number, rowProps: RowProps) => string | number
}
