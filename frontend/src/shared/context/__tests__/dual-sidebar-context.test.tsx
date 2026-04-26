import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { DualSidebarProvider, useDualSidebar } from '../dual-sidebar-context'

const createWrapper = (defaultOpen = false, defaultSection: string | null = null) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <DualSidebarProvider defaultOpen={defaultOpen} defaultSection={defaultSection}>
      {children}
    </DualSidebarProvider>
  )
  Wrapper.displayName = 'DualSidebarTestWrapper'
  return Wrapper
}

describe('DualSidebarProvider', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>
  let listenerCallbacks: Array<() => void> = []
  let localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    listenerCallbacks = []
    localStorageMock = {}

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
      configurable: true,
      value: matchMediaMock,
    })

    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    Object.defineProperty(window, 'localStorage', {
      writable: true,
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key]
        }),
        clear: vi.fn(() => {
          localStorageMock = {}
        }),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial state', () => {
    it('initializes with secondaryOpen=false on mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
    })

    it('initializes with secondaryOpen=false on desktop viewport without localStorage', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
    })

    it('initializes with secondaryOpen=true on desktop viewport with localStorage=true', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['secondary_sidebar_state'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(true)
    })

    it('ignores localStorage on mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      localStorageMock['secondary_sidebar_state'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
    })

    it('initializes activeSection from localStorage', () => {
      localStorageMock['active_section'] = 'home'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.activeSection).toBe('home')
    })

    it('initializes activeSection from defaultSection prop when no localStorage', () => {
      const wrapper = createWrapper(false, 'settings')
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.activeSection).toBe('settings')
    })

    it('prefers localStorage over defaultSection prop', () => {
      localStorageMock['active_section'] = 'admin'

      const wrapper = createWrapper(false, 'settings')
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.activeSection).toBe('admin')
    })

    it('respects localStorage=false on desktop with activeSection present', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['active_section'] = 'home'
      localStorageMock['secondary_sidebar_state'] = 'false'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
      expect(result.current.activeSection).toBe('home')
    })

    it('initializes closed on desktop when activeSection present but no sidebar state in localStorage', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['active_section'] = 'settings'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
      expect(result.current.activeSection).toBe('settings')
    })
  })

  describe('Viewport transition behavior', () => {
    it('closes secondary sidebar when transitioning from desktop to mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['active_section'] = 'home'
      localStorageMock['secondary_sidebar_state'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
      })

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })

    it('opens secondary sidebar when transitioning from mobile to desktop with activeSection', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)

      act(() => {
        result.current.setActiveSection('home')
      })

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
      })
    })

    it('keeps secondary sidebar closed when transitioning to desktop without activeSection', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
      expect(result.current.activeSection).toBe(null)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })

    it('maintains consistent state across rapid viewport oscillation', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['active_section'] = 'home'
      localStorageMock['secondary_sidebar_state'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
      })

      const widths = [767, 768, 767, 768, 767, 768, 1024]

      act(() => {
        widths.forEach(width => {
          Object.defineProperty(window, 'innerWidth', { writable: true, value: width })
          listenerCallbacks.forEach(cb => cb())
        })
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
        expect(result.current.activeSection).toBe('home')
      })
    })

    it('closes sidebar on mobile transition even when manually opened with activeSection', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setActiveSection('home')
        result.current.setSecondaryOpen(true)
      })

      expect(result.current.secondaryOpen).toBe(true)

      act(() => {
        result.current.setActiveSection('settings')
        result.current.setActiveSection('admin')
      })

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
        expect(result.current.activeSection).toBe('admin')
      })
    })
  })

  describe('Active section management', () => {
    it('persists activeSection to localStorage when set', () => {
      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setActiveSection('home')
      })

      expect(window.localStorage.setItem).toHaveBeenCalledWith('active_section', 'home')
      expect(localStorageMock['active_section']).toBe('home')
    })

    it('removes activeSection from localStorage when cleared', () => {
      localStorageMock['active_section'] = 'home'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setActiveSection(null)
      })

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('active_section')
      expect(localStorageMock['active_section']).toBeUndefined()
    })

    it('changing activeSection does not automatically open sidebar (requires explicit setSecondaryOpen)', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)

      act(() => {
        result.current.setActiveSection('home')
      })

      expect(result.current.activeSection).toBe('home')
      expect(result.current.secondaryOpen).toBe(false)
    })

    it('changing activeSection on mobile does not open sidebar', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)

      act(() => {
        result.current.setActiveSection('home')
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })
  })

  describe('Manual sidebar control', () => {
    it('setSecondaryOpen updates state and persists to localStorage', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setSecondaryOpen(true)
      })

      expect(result.current.secondaryOpen).toBe(true)
      expect(window.localStorage.setItem).toHaveBeenCalledWith('secondary_sidebar_state', 'true')
    })

    it('toggleSecondary flips secondaryOpen state', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      const initialState = result.current.secondaryOpen

      act(() => {
        result.current.toggleSecondary()
      })

      expect(result.current.secondaryOpen).toBe(!initialState)

      act(() => {
        result.current.toggleSecondary()
      })

      expect(result.current.secondaryOpen).toBe(initialState)
    })

    it('manual setSecondaryOpen on desktop is overridden by viewport transition to mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setSecondaryOpen(true)
      })

      expect(result.current.secondaryOpen).toBe(true)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })
  })

  describe('Breakpoint edge cases', () => {
    it('treats viewport width exactly at 768px as desktop', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 })
      localStorageMock['active_section'] = 'home'
      localStorageMock['secondary_sidebar_state'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
      })
    })

    it('treats viewport width at 767px as mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 767 })
      localStorageMock['active_section'] = 'home'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })

    it('transitions correctly when crossing 768px boundary from below', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 767 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setActiveSection('home')
      })

      expect(result.current.secondaryOpen).toBe(false)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
      })
    })

    it('transitions correctly when crossing 768px boundary from above', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 768 })
      localStorageMock['active_section'] = 'home'
      localStorageMock['secondary_sidebar_state'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
      })

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 767 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })
  })

  describe('Context error handling', () => {
    it('throws error when useDualSidebar is used outside provider', () => {
      expect(() => {
        renderHook(() => useDualSidebar())
      }).toThrow('useDualSidebar must be used within a DualSidebarProvider.')
    })
  })

  describe('State consistency invariants', () => {
    it('maintains activeSection independent of secondaryOpen changes', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setActiveSection('home')
      })

      expect(result.current.activeSection).toBe('home')

      act(() => {
        result.current.setSecondaryOpen(false)
      })

      expect(result.current.activeSection).toBe('home')
      expect(result.current.secondaryOpen).toBe(false)

      act(() => {
        result.current.setSecondaryOpen(true)
      })

      expect(result.current.activeSection).toBe('home')
      expect(result.current.secondaryOpen).toBe(true)
    })

    it('ensures viewport transition to mobile closes sidebar even if manually opened', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      act(() => {
        result.current.setActiveSection('home')
        result.current.setSecondaryOpen(true)
      })

      expect(result.current.activeSection).toBe('home')
      expect(result.current.secondaryOpen).toBe(true)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
        expect(result.current.activeSection).toBe('home')
      })
    })
  })

  describe('Mount vs transition distinction', () => {
    it('does not trigger viewport effect on mount when viewport matches initial state', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['active_section'] = 'home'
      localStorageMock['secondary_sidebar_state'] = 'false'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
      expect(result.current.activeSection).toBe('home')

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })

    it('triggers viewport effect only on actual desktop to mobile transition', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['secondary_sidebar_state'] = 'true'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(true)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })

    it('triggers viewport effect only on actual mobile to desktop transition', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      localStorageMock['active_section'] = 'home'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)

      act(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
        listenerCallbacks.forEach(cb => cb())
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(true)
      })
    })

    it('does not open sidebar on mount when activeSection exists but localStorage says closed', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['active_section'] = 'admin'
      localStorageMock['secondary_sidebar_state'] = 'false'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)
      expect(result.current.activeSection).toBe('admin')

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })

    it('preserves localStorage authority across multiple section changes without viewport transitions', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      localStorageMock['active_section'] = 'home'
      localStorageMock['secondary_sidebar_state'] = 'false'

      const wrapper = createWrapper()
      const { result } = renderHook(() => useDualSidebar(), { wrapper })

      expect(result.current.secondaryOpen).toBe(false)

      act(() => {
        result.current.setActiveSection('settings')
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })

      act(() => {
        result.current.setActiveSection('admin')
      })

      await waitFor(() => {
        expect(result.current.secondaryOpen).toBe(false)
      })
    })
  })
})
