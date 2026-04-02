import type { CSSProperties, ForwardedRef, ReactNode, UIEvent } from 'react'
import {
  createElement,
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'

import { useElementHeight } from './use-element-height'
import type { ListImperativeAPI, ListProps, ScrollAlign } from './types'

interface BoundsCache {
  offsets: number[]
  sizes: number[]
  total: number
}

const createBoundsCache = (itemCount: number, getSize: (i: number) => number): BoundsCache => {
  const offsets: number[] = []
  const sizes: number[] = []
  let total = 0

  for (let i = 0; i < itemCount; i++) {
    offsets.push(total)
    const size = getSize(i)
    sizes.push(size)
    total += size
  }

  return { offsets, sizes, total }
}

const findVisibleRange = (
  { offsets }: BoundsCache,
  scrollOffset: number,
  viewportHeight: number,
  overscan: number,
): [start: number, end: number] => {
  const count = offsets.length
  if (count === 0) return [0, 0]

  let lo = 0
  let hi = count - 1

  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] < scrollOffset) lo = mid + 1
    else hi = mid
  }

  const start = Math.max(0, lo - 1 - overscan)
  const endOffset = scrollOffset + viewportHeight

  while (lo < count && offsets[lo] < endOffset) lo++

  return [start, Math.min(count, lo + overscan)]
}

const calculateScrollTarget = (
  align: ScrollAlign,
  itemOffset: number,
  itemSize: number,
  currentScroll: number,
  viewportSize: number,
  totalSize: number,
): number | null => {
  let target: number

  switch (align) {
    case 'start':
      target = itemOffset
      break
    case 'end':
      target = itemOffset - viewportSize + itemSize
      break
    case 'center':
      target = itemOffset - viewportSize / 2 + itemSize / 2
      break
    default: {
      const itemEnd = itemOffset + itemSize
      const viewportEnd = currentScroll + viewportSize
      if (itemOffset < currentScroll) target = itemOffset
      else if (itemEnd > viewportEnd) target = itemEnd - viewportSize
      else return null
    }
  }

  return Math.max(0, Math.min(target, totalSize - viewportSize))
}

const ListInner = <RowProps extends object>(
  {
    className,
    defaultHeight,
    listRef,
    onRowsRendered,
    overscanCount = 2,
    rowComponent: RowComponent,
    rowCount,
    rowHeight,
    rowProps,
    style,
    itemKey,
  }: ListProps<RowProps>,
  ref: ForwardedRef<ListImperativeAPI>,
): ReactNode => {
  const [outerRef, clientHeight] = useElementHeight(defaultHeight)
  const [scrollOffset, setScrollOffset] = useState(0)

  const getRowHeight = useCallback(
    (index: number) => (typeof rowHeight === 'function' ? rowHeight(index, rowProps) : rowHeight),
    [rowHeight, rowProps],
  )

  const bounds = useMemo(() => createBoundsCache(rowCount, getRowHeight), [rowCount, getRowHeight])

  const [startIndex, endIndex] = useMemo(
    () => findVisibleRange(bounds, scrollOffset, clientHeight, overscanCount),
    [bounds, scrollOffset, clientHeight, overscanCount],
  )

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollOffset(e.currentTarget.scrollTop)
  }, [])

  useLayoutEffect(() => {
    if (rowCount > 0) {
      const range = { startIndex, stopIndex: endIndex - 1 }
      onRowsRendered?.(range, range)
    }
  }, [startIndex, endIndex, rowCount, onRowsRendered])

  const api: ListImperativeAPI = useMemo(
    () => ({
      get element() {
        return outerRef.current
      },
      scrollToRow({ align = 'auto', behavior = 'auto', index }) {
        if (index < 0 || index >= rowCount || !outerRef.current) return

        const target = calculateScrollTarget(
          align,
          bounds.offsets[index],
          bounds.sizes[index],
          scrollOffset,
          clientHeight,
          bounds.total,
        )

        if (target !== null) {
          outerRef.current.scrollTo({ top: target, behavior })
        }
      },
    }),
    [outerRef, rowCount, bounds, scrollOffset, clientHeight],
  )

  useImperativeHandle(ref, () => api)

  useLayoutEffect(() => {
    listRef?.(api)
    return () => listRef?.(null)
  }, [listRef, api])

  const items: ReactNode[] = []

  for (let index = startIndex; index < endIndex; index++) {
    const itemStyle: CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: bounds.sizes[index],
      overflow: 'visible',
      transform: `translateY(${bounds.offsets[index]}px)`,
    }

    items.push(
      createElement(
        'div',
        {
          key: itemKey ? itemKey(index, rowProps) : index,
          style: itemStyle,
          'aria-posinset': index + 1,
          'aria-setsize': rowCount,
          role: 'listitem',
        },
        createElement(RowComponent, { index, rowProps }),
      ),
    )
  }

  const outerStyle: CSSProperties = {
    position: 'relative',
    height: defaultHeight,
    width: '100%',
    overflow: 'auto',
    willChange: 'transform',
    ...style,
  }

  const innerStyle: CSSProperties = {
    height: bounds.total,
    width: '100%',
    position: 'relative',
  }

  return createElement(
    'div',
    { ref: outerRef, className, onScroll: handleScroll, style: outerStyle, role: 'list' },
    createElement('div', { style: innerStyle }, items),
  )
}

export const List = memo(forwardRef(ListInner)) as <RowProps extends object>(
  props: ListProps<RowProps> & { ref?: ForwardedRef<ListImperativeAPI> },
) => ReactNode

export type { ListImperativeAPI }
