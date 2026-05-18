import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlProvider } from 'react-intl'
import * as React from 'react'
import { useAuth } from '../use-auth'
import type { User } from '@shared/base-types'

const mockApiFetch = vi.fn()

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(IntlProvider, { locale: 'en', messages: {} }, children),
    )
  }
}

const stubUser: User = {
  id: 'u1',
  name: 'Test User',
  mail: 'test@example.com',
  roles: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('useAuth — isBootstrapped gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when isBootstrapped is false', () => {
    it('does not issue a request to /users/current', () => {
      renderHook(() => useAuth(false), { wrapper: createWrapper() })

      expect(mockApiFetch).not.toHaveBeenCalled()
    })

    it('reports isLoading as true', () => {
      const { result } = renderHook(() => useAuth(false), { wrapper: createWrapper() })

      expect(result.current.isLoading).toBe(true)
    })

    it('reports isLoggedIn as false', () => {
      const { result } = renderHook(() => useAuth(false), { wrapper: createWrapper() })

      expect(result.current.isLoggedIn).toBe(false)
    })

    it('reports user as undefined', () => {
      const { result } = renderHook(() => useAuth(false), { wrapper: createWrapper() })

      expect(result.current.user).toBeUndefined()
    })
  })

  describe('when isBootstrapped is true', () => {
    it('issues a request to /users/current', async () => {
      mockApiFetch.mockResolvedValue(stubUser)

      renderHook(() => useAuth(true), { wrapper: createWrapper() })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/users/current', expect.any(Object)))
    })

    it('populates user from the response', async () => {
      mockApiFetch.mockResolvedValue(stubUser)

      const { result } = renderHook(() => useAuth(true), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.user).toEqual(stubUser))
    })

    it('reports isLoggedIn as true when the server returns a user', async () => {
      mockApiFetch.mockResolvedValue(stubUser)

      const { result } = renderHook(() => useAuth(true), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoggedIn).toBe(true))
    })

    it('reports isLoading as false once the request settles', async () => {
      mockApiFetch.mockResolvedValue(stubUser)

      const { result } = renderHook(() => useAuth(true), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('reports isLoggedIn as false and user as undefined when the server returns no user', async () => {
      mockApiFetch.mockRejectedValue(new Error('Unauthorized'))

      const { result } = renderHook(() => useAuth(true), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.isLoggedIn).toBe(false)
      expect(result.current.user).toBeUndefined()
    })
  })

  describe('isBootstrapped transition from false to true', () => {
    it('does not request /users/current while false, then requests it after transitioning to true', async () => {
      mockApiFetch.mockResolvedValue(stubUser)

      const { result, rerender } = renderHook(({ bootstrapped }: { bootstrapped: boolean }) => useAuth(bootstrapped), {
        wrapper: createWrapper(),
        initialProps: { bootstrapped: false },
      })

      expect(mockApiFetch).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(true)

      rerender({ bootstrapped: true })

      await waitFor(() => expect(result.current.isLoggedIn).toBe(true))
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    it('isLoading transitions from true (pre-bootstrap) to false (post-fetch) without intermediate false', async () => {
      mockApiFetch.mockResolvedValue(stubUser)

      const observed: boolean[] = []
      const { result, rerender } = renderHook(
        ({ bootstrapped }: { bootstrapped: boolean }) => {
          const auth = useAuth(bootstrapped)
          observed.push(auth.isLoading)
          return auth
        },
        { wrapper: createWrapper(), initialProps: { bootstrapped: false } },
      )

      expect(result.current.isLoading).toBe(true)

      rerender({ bootstrapped: true })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const falseBeforeTrue = observed.indexOf(false)
      const firstTrue = observed.indexOf(true)
      expect(firstTrue).toBeLessThan(falseBeforeTrue === -1 ? Infinity : falseBeforeTrue)
    })
  })

  describe('admin role detection', () => {
    it('reports isAdmin as true when the user has the administrator role', async () => {
      mockApiFetch.mockResolvedValue({ ...stubUser, roles: ['administrator'] })

      const { result } = renderHook(() => useAuth(true), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isAdmin).toBe(true))
    })

    it('reports isAdmin as false when the user has no roles', async () => {
      mockApiFetch.mockResolvedValue({ ...stubUser, roles: [] })

      const { result } = renderHook(() => useAuth(true), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoggedIn).toBe(true))
      expect(result.current.isAdmin).toBe(false)
    })

    it('reports isAdmin as false before bootstrap completes', () => {
      const { result } = renderHook(() => useAuth(false), { wrapper: createWrapper() })

      expect(result.current.isAdmin).toBeFalsy()
    })
  })
})
