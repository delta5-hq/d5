import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type React from 'react'
import { useSortableHeader, type SortDirection } from './use-sortable-header'

describe('useSortableHeader', () => {
  describe('aria-sort attribute mapping', () => {
    it('returns ascending when direction is ascending', () => {
      const { result } = renderHook(() => useSortableHeader(vi.fn(), 'ascending'))

      expect(result.current['aria-sort']).toBe('ascending')
    })

    it('returns descending when direction is descending', () => {
      const { result } = renderHook(() => useSortableHeader(vi.fn(), 'descending'))

      expect(result.current['aria-sort']).toBe('descending')
    })

    it('returns none when direction is none', () => {
      const { result } = renderHook(() => useSortableHeader(vi.fn(), 'none'))

      expect(result.current['aria-sort']).toBe('none')
    })
  })

  describe('keyboard activation', () => {
    it('activates on Enter key', () => {
      const onSort = vi.fn()
      const { result } = renderHook(() => useSortableHeader(onSort, 'none'))
      const preventDefault = vi.fn()

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onSort).toHaveBeenCalledTimes(1)
      expect(preventDefault).toHaveBeenCalledTimes(1)
    })

    it('activates on Space key', () => {
      const onSort = vi.fn()
      const { result } = renderHook(() => useSortableHeader(onSort, 'none'))
      const preventDefault = vi.fn()

      result.current.handleKeyDown({
        key: ' ',
        preventDefault,
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onSort).toHaveBeenCalledTimes(1)
      expect(preventDefault).toHaveBeenCalledTimes(1)
    })

    it('ignores non-activation keys', () => {
      const onSort = vi.fn()
      const { result } = renderHook(() => useSortableHeader(onSort, 'none'))

      const keys = ['Tab', 'Escape', 'a', 'ArrowUp', 'ArrowDown']
      keys.forEach(key => {
        result.current.handleKeyDown({
          key,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLElement>)
      })

      expect(onSort).not.toHaveBeenCalled()
    })
  })

  describe('tabIndex attribute', () => {
    it('returns tabIndex 0 for keyboard focus', () => {
      const { result } = renderHook(() => useSortableHeader(vi.fn(), 'none'))

      expect(result.current.tabIndex).toBe(0)
    })

    it('tabIndex remains 0 across all sort directions', () => {
      const directions: SortDirection[] = ['none', 'ascending', 'descending']

      directions.forEach(direction => {
        const { result } = renderHook(() => useSortableHeader(vi.fn(), direction))
        expect(result.current.tabIndex).toBe(0)
      })
    })
  })

  describe('sort direction state transitions', () => {
    it('updates aria-sort when direction changes from none to ascending', () => {
      const { result, rerender } = renderHook(({ direction }) => useSortableHeader(vi.fn(), direction), {
        initialProps: { direction: 'none' as SortDirection },
      })

      expect(result.current['aria-sort']).toBe('none')

      rerender({ direction: 'ascending' as SortDirection })

      expect(result.current['aria-sort']).toBe('ascending')
    })

    it('updates aria-sort when direction changes from ascending to descending', () => {
      const { result, rerender } = renderHook(({ direction }) => useSortableHeader(vi.fn(), direction), {
        initialProps: { direction: 'ascending' as SortDirection },
      })

      expect(result.current['aria-sort']).toBe('ascending')

      rerender({ direction: 'descending' as SortDirection })

      expect(result.current['aria-sort']).toBe('descending')
    })

    it('updates aria-sort when direction cycles back to none', () => {
      const { result, rerender } = renderHook(({ direction }) => useSortableHeader(vi.fn(), direction), {
        initialProps: { direction: 'descending' as SortDirection },
      })

      expect(result.current['aria-sort']).toBe('descending')

      rerender({ direction: 'none' as SortDirection })

      expect(result.current['aria-sort']).toBe('none')
    })
  })

  describe('callback reference stability', () => {
    it('uses latest onSort callback after rerender', () => {
      const onSort1 = vi.fn()
      const onSort2 = vi.fn()
      const { result, rerender } = renderHook(({ onSort }) => useSortableHeader(onSort, 'none'), {
        initialProps: { onSort: onSort1 },
      })

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(onSort1).toHaveBeenCalledTimes(1)

      rerender({ onSort: onSort2 })
      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(onSort2).toHaveBeenCalledTimes(1)
      expect(onSort1).toHaveBeenCalledTimes(1)
    })

    it('does not invoke onSort on mount', () => {
      const onSort = vi.fn()
      renderHook(() => useSortableHeader(onSort, 'none'))

      expect(onSort).not.toHaveBeenCalled()
    })
  })

  describe('multiple hook instances', () => {
    it('operates independently with different sort directions', () => {
      const onSort1 = vi.fn()
      const onSort2 = vi.fn()
      const { result: result1 } = renderHook(() => useSortableHeader(onSort1, 'ascending'))
      const { result: result2 } = renderHook(() => useSortableHeader(onSort2, 'descending'))

      expect(result1.current['aria-sort']).toBe('ascending')
      expect(result2.current['aria-sort']).toBe('descending')

      result1.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onSort1).toHaveBeenCalledTimes(1)
      expect(onSort2).not.toHaveBeenCalled()
    })

    it('handles three instances with different states', () => {
      const { result: result1 } = renderHook(() => useSortableHeader(vi.fn(), 'none'))
      const { result: result2 } = renderHook(() => useSortableHeader(vi.fn(), 'ascending'))
      const { result: result3 } = renderHook(() => useSortableHeader(vi.fn(), 'descending'))

      expect(result1.current['aria-sort']).toBe('none')
      expect(result2.current['aria-sort']).toBe('ascending')
      expect(result3.current['aria-sort']).toBe('descending')
    })
  })

  describe('return value contract', () => {
    it('returns object with expected properties', () => {
      const { result } = renderHook(() => useSortableHeader(vi.fn(), 'none'))

      expect(result.current).toEqual({
        handleKeyDown: expect.any(Function),
        tabIndex: 0,
        'aria-sort': 'none',
      })
    })

    it('handler reference changes on each render', () => {
      const { result, rerender } = renderHook(() => useSortableHeader(vi.fn(), 'none'))
      const firstHandler = result.current.handleKeyDown

      rerender()

      expect(result.current.handleKeyDown).not.toBe(firstHandler)
    })

    it('handler remains functionally equivalent across renders', () => {
      const onSort = vi.fn()
      const { result, rerender } = renderHook(() => useSortableHeader(onSort, 'none'))

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(onSort).toHaveBeenCalledTimes(1)

      rerender()

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)
      expect(onSort).toHaveBeenCalledTimes(2)
    })
  })

  describe('consecutive activation handling', () => {
    it('handles rapid consecutive activations', () => {
      const onSort = vi.fn()
      const { result } = renderHook(() => useSortableHeader(onSort, 'none'))

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      result.current.handleKeyDown({
        key: ' ',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      result.current.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLElement>)

      expect(onSort).toHaveBeenCalledTimes(3)
    })
  })

  describe('preventDefault execution order', () => {
    it('calls preventDefault before onSort even when onSort throws', () => {
      const throwingCallback = vi.fn(() => {
        throw new Error('sort error')
      })
      const preventDefault = vi.fn()
      const { result } = renderHook(() => useSortableHeader(throwingCallback, 'none'))

      expect(() =>
        result.current.handleKeyDown({
          key: 'Enter',
          preventDefault,
        } as unknown as React.KeyboardEvent<HTMLElement>),
      ).toThrow('sort error')

      expect(preventDefault).toHaveBeenCalledTimes(1)
      expect(throwingCallback).toHaveBeenCalledTimes(1)
    })
  })
})
