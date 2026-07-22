import type { KeyboardEvent } from 'react'

export type SortDirection = 'ascending' | 'descending' | 'none'

export const useSortableHeader = (onSort: () => void, sortDirection: SortDirection) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSort()
    }
  }

  return {
    handleKeyDown,
    tabIndex: 0 as const,
    'aria-sort': sortDirection,
  }
}
