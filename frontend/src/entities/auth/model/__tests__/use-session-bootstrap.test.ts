import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSessionBootstrap } from '../use-session-bootstrap'

const mockApiFetch = vi.fn()

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

describe('useSessionBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('returns false synchronously before the refresh request settles', () => {
      mockApiFetch.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() => useSessionBootstrap())

      expect(result.current).toBe(false)
    })
  })

  describe('bootstrap completion on success', () => {
    it('transitions to true after the refresh request resolves', async () => {
      mockApiFetch.mockResolvedValue({})

      const { result } = renderHook(() => useSessionBootstrap())

      await waitFor(() => expect(result.current).toBe(true))
    })

    it('issues exactly one request to the correct refresh endpoint', async () => {
      mockApiFetch.mockResolvedValue({})

      renderHook(() => useSessionBootstrap())

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
      expect(mockApiFetch).toHaveBeenCalledWith('/auth/refresh', { method: 'POST' })
    })
  })

  describe('bootstrap completion on failure', () => {
    it('transitions to true even when the refresh request rejects', async () => {
      mockApiFetch.mockRejectedValue(new Error('Unauthorized'))

      const { result } = renderHook(() => useSessionBootstrap())

      await waitFor(() => expect(result.current).toBe(true))
    })

    it('transitions to true for any HTTP error status', async () => {
      const statuses = [400, 401, 403, 500, 503]

      for (const status of statuses) {
        mockApiFetch.mockRejectedValueOnce(Object.assign(new Error('HTTP error'), { status }))
        const { result, unmount } = renderHook(() => useSessionBootstrap())
        await waitFor(() => expect(result.current).toBe(true))
        unmount()
        vi.clearAllMocks()
      }
    })

    it('does not surface the rejection to the caller', async () => {
      mockApiFetch.mockRejectedValue(new Error('Network error'))

      await expect(
        act(async () => {
          renderHook(() => useSessionBootstrap())
        }),
      ).resolves.not.toThrow()
    })
  })

  describe('state monotonicity', () => {
    it('never reverts from true back to false', async () => {
      mockApiFetch.mockResolvedValue({})

      const { result } = renderHook(() => useSessionBootstrap())

      await waitFor(() => expect(result.current).toBe(true))
      expect(result.current).toBe(true)
    })
  })

  describe('StrictMode double-effect guard', () => {
    it('issues exactly one request when React fires the effect twice (StrictMode simulation)', async () => {
      mockApiFetch.mockResolvedValue({})

      renderHook(() => useSessionBootstrap(), { reactStrictMode: true })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    it('still transitions to true under StrictMode double-invoke', async () => {
      mockApiFetch.mockResolvedValue({})

      const { result } = renderHook(() => useSessionBootstrap(), { reactStrictMode: true })

      await waitFor(() => expect(result.current).toBe(true))
    })
  })

  describe('unmount before completion', () => {
    it('does not throw when the component unmounts while the request is in flight', async () => {
      let resolve!: (v: unknown) => void
      mockApiFetch.mockReturnValue(
        new Promise(r => {
          resolve = r
        }),
      )

      const { unmount } = renderHook(() => useSessionBootstrap())
      unmount()

      await expect(
        act(async () => {
          resolve({})
        }),
      ).resolves.not.toThrow()
    })

    it('issues exactly one request regardless of whether unmount precedes resolution', async () => {
      mockApiFetch.mockResolvedValue({})

      const { unmount } = renderHook(() => useSessionBootstrap())
      unmount()

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
    })
  })
})
