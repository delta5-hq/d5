import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useViewportBreakpoint } from '../use-viewport-breakpoint'

describe('useViewportBreakpoint', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>
  let listenerCallbacks: Array<() => void> = []

  beforeEach(() => {
    listenerCallbacks = []

    matchMediaMock = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === 'change') {
          listenerCallbacks.push(callback)
        }
      }),
      removeEventListener: vi.fn((event: string, callback: () => void) => {
        const index = listenerCallbacks.indexOf(callback)
        if (index > -1) {
          listenerCallbacks.splice(index, 1)
        }
      }),
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    })

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('returns desktop state when viewport is above breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const { result } = renderHook(() => useViewportBreakpoint())

      expect(result.current).toBe(false)
    })

    it('returns mobile state when viewport is below breakpoint', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })

      const { result } = renderHook(() => useViewportBreakpoint())

      expect(result.current).toBe(true)
    })

    it('treats exact breakpoint width as desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 })

      const { result } = renderHook(() => useViewportBreakpoint())

      expect(result.current).toBe(false)
    })

    it('treats one pixel below breakpoint as mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 767 })

      const { result } = renderHook(() => useViewportBreakpoint())

      expect(result.current).toBe(true)
    })
  })

  describe('custom breakpoint', () => {
    it('respects custom breakpoint value', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1000 })

      const { result } = renderHook(() => useViewportBreakpoint(1024))

      expect(result.current).toBe(true)
    })

    it('creates matchMedia with correct custom breakpoint query', () => {
      renderHook(() => useViewportBreakpoint(1024))

      expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 1023px)')
    })
  })

  describe('viewport change detection', () => {
    it('updates state when viewport crosses from desktop to mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const { result } = renderHook(() => useViewportBreakpoint())

      expect(result.current).toBe(false)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current).toBe(true)
      })
    })

    it('updates state when viewport crosses from mobile to desktop', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })

      const { result } = renderHook(() => useViewportBreakpoint())

      expect(result.current).toBe(true)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current).toBe(false)
      })
    })

    it('does not update state for width changes within same breakpoint category', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const { result } = renderHook(() => useViewportBreakpoint())

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current).toBe(false)
      })
    })
  })

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const { unmount } = renderHook(() => useViewportBreakpoint())

      const initialCallbackCount = listenerCallbacks.length

      unmount()

      expect(listenerCallbacks.length).toBeLessThan(initialCallbackCount)
    })

    it('does not trigger callbacks after unmount', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const { result, unmount } = renderHook(() => useViewportBreakpoint())

      unmount()

      const stateBeforeChange = result.current

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
        listenerCallbacks.forEach(cb => cb())
      })

      expect(result.current).toBe(stateBeforeChange)
    })
  })

  describe('edge cases', () => {
    it('handles rapid successive viewport changes', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const { result } = renderHook(() => useViewportBreakpoint())

      const widths = [375, 768, 600, 1024, 500, 1280]

      act(() => {
        widths.forEach(width => {
          Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
          listenerCallbacks.forEach(cb => cb())
        })
      })

      await waitFor(() => {
        expect(result.current).toBe(false)
      })
    })

    it('maintains consistency across breakpoint oscillation', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 })

      const { result } = renderHook(() => useViewportBreakpoint())

      act(() => {
        ;[767, 768, 767, 768, 767, 768].forEach(width => {
          Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
          listenerCallbacks.forEach(cb => cb())
        })
      })

      await waitFor(() => {
        expect(result.current).toBe(false)
      })
    })
  })
})
