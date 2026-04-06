import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { useScopedIntegrations } from './use-scoped-integrations'
import type { IntegrationSettings } from '@shared/base-types'

const mockApiFetch = vi.fn()

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: (...args: any[]) => mockApiFetch(...args),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function ({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useScopedIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('app-wide scope behavior', () => {
    it('fetches only app-wide data when workflowId is null', async () => {
      const appWideData: IntegrationSettings = { openai: { apiKey: 'key', model: 'gpt-4' } }
      mockApiFetch.mockResolvedValueOnce(appWideData)

      const { result } = renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      expect(mockApiFetch).toHaveBeenCalledTimes(1)
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', { version: undefined })
      expect(result.current.currentScopeData).toEqual(appWideData)
      expect(result.current.appWideScopeData).toBeUndefined()
    })

    it('does not fetch app-wide separately when workflowId is null', async () => {
      mockApiFetch.mockResolvedValueOnce({ openai: { apiKey: 'key', model: 'gpt-4' } })

      renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())

      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    it('returns isLoading false after app-wide fetch completes', async () => {
      mockApiFetch.mockResolvedValueOnce({ openai: { apiKey: 'key', model: 'gpt-4' } })

      const { result } = renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })
  })

  describe('workflow scope behavior', () => {
    it('fetches both workflow and app-wide data when workflowId provided', async () => {
      const workflowData: IntegrationSettings = { workflowId: 'wf-123', openai: { apiKey: 'wf-key', model: 'gpt-4' } }
      const appWideData: IntegrationSettings = { claude: { apiKey: 'app-key', model: 'claude-3' } }

      mockApiFetch.mockResolvedValueOnce(workflowData).mockResolvedValueOnce(appWideData)

      const { result } = renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())
      await waitFor(() => expect(result.current.appWideScopeData).toBeDefined())

      expect(mockApiFetch).toHaveBeenCalledTimes(2)
      expect(mockApiFetch).toHaveBeenCalledWith('/integration?workflowId=wf-123', { version: undefined })
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', { version: undefined })
      expect(result.current.currentScopeData).toEqual(workflowData)
      expect(result.current.appWideScopeData).toEqual(appWideData)
    })

    it('fetches both queries in parallel', async () => {
      const workflowData: IntegrationSettings = { workflowId: 'wf-123', openai: { apiKey: 'wf-key', model: 'gpt-4' } }
      const appWideData: IntegrationSettings = { claude: { apiKey: 'app-key', model: 'claude-3' } }

      let workflowResolve: (value: any) => void
      let appWideResolve: (value: any) => void
      const workflowPromise = new Promise(resolve => {
        workflowResolve = resolve
      })
      const appWidePromise = new Promise(resolve => {
        appWideResolve = resolve
      })

      mockApiFetch.mockImplementationOnce(() => workflowPromise).mockImplementationOnce(() => appWidePromise)

      renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2))

      workflowResolve!(workflowData)
      appWideResolve!(appWideData)
    })

    it('returns isLoading true while either query is loading', async () => {
      mockApiFetch.mockImplementation(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve({ openai: { apiKey: 'key', model: 'gpt-4' } }), 100)
          }),
      )

      const { result } = renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      expect(result.current.isLoading).toBe(true)
    })

    it('returns isLoading false when both queries complete', async () => {
      mockApiFetch.mockResolvedValueOnce({ workflowId: 'wf-123' }).mockResolvedValueOnce({})

      const { result } = renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })
  })

  describe('refetch behavior', () => {
    it('refetches only current scope when workflowId is null', async () => {
      mockApiFetch.mockResolvedValue({ openai: { apiKey: 'key', model: 'gpt-4' } })

      const { result } = renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      mockApiFetch.mockClear()
      await result.current.refetch()

      expect(mockApiFetch).toHaveBeenCalledTimes(1)
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', { version: undefined })
    })

    it('refetches both scopes when workflowId is provided', async () => {
      mockApiFetch.mockResolvedValue({ openai: { apiKey: 'key', model: 'gpt-4' } })

      const { result } = renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      mockApiFetch.mockClear()
      await result.current.refetch()

      expect(mockApiFetch).toHaveBeenCalledTimes(2)
      expect(mockApiFetch).toHaveBeenCalledWith('/integration?workflowId=wf-123', { version: undefined })
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', { version: undefined })
    })

    it('awaits both refetch operations before resolving', async () => {
      mockApiFetch.mockResolvedValue({})

      const { result } = renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      let refetchComplete = false
      result.current.refetch().then(() => {
        refetchComplete = true
      })

      await waitFor(() => expect(refetchComplete).toBe(true))
    })

    it('updates data after refetch', async () => {
      const initialData: IntegrationSettings = { openai: { apiKey: 'old-key', model: 'gpt-3.5' } }
      const updatedData: IntegrationSettings = { openai: { apiKey: 'new-key', model: 'gpt-4' } }

      mockApiFetch.mockResolvedValueOnce(initialData).mockResolvedValueOnce(updatedData)

      const { result } = renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.currentScopeData).toEqual(initialData))

      await result.current.refetch()

      await waitFor(() => expect(result.current.currentScopeData).toEqual(updatedData))
    })
  })

  describe('workflowId changes', () => {
    it('switches from app-wide to workflow scope when workflowId changes from null', async () => {
      mockApiFetch.mockResolvedValue({ openai: { apiKey: 'key', model: 'gpt-4' } })

      const { result, rerender } = renderHook(({ wfId }) => useScopedIntegrations(wfId), {
        wrapper: createWrapper(),
        initialProps: { wfId: null as string | null },
      })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      mockApiFetch.mockClear()
      rerender({ wfId: 'wf-123' })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2))
      expect(mockApiFetch).toHaveBeenCalledWith('/integration?workflowId=wf-123', { version: undefined })
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', { version: undefined })
    })

    it('switches from workflow to app-wide scope when workflowId changes to null', async () => {
      mockApiFetch.mockResolvedValue({ openai: { apiKey: 'key', model: 'gpt-4' } })

      const { result, rerender } = renderHook(({ wfId }) => useScopedIntegrations(wfId), {
        wrapper: createWrapper(),
        initialProps: { wfId: 'wf-123' as string | null },
      })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      mockApiFetch.mockClear()
      rerender({ wfId: null })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', { version: undefined })
    })

    it('switches between different workflow IDs', async () => {
      mockApiFetch.mockResolvedValue({ openai: { apiKey: 'key', model: 'gpt-4' } })

      const { result, rerender } = renderHook(({ wfId }) => useScopedIntegrations(wfId), {
        wrapper: createWrapper(),
        initialProps: { wfId: 'wf-123' as string | null },
      })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      mockApiFetch.mockClear()
      rerender({ wfId: 'wf-456' })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
      expect(mockApiFetch).toHaveBeenCalledWith('/integration?workflowId=wf-456', { version: undefined })
    })
  })

  describe('error handling', () => {
    it('handles fetch error gracefully', async () => {
      const error = new Error('Network error')
      mockApiFetch.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.currentScopeData).toBeUndefined()
    })

    it('handles partial failure in dual fetch', async () => {
      const workflowData: IntegrationSettings = { workflowId: 'wf-123', openai: { apiKey: 'key', model: 'gpt-4' } }
      const error = new Error('Network error')

      mockApiFetch.mockResolvedValueOnce(workflowData).mockRejectedValueOnce(error)

      const { result } = renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.currentScopeData).toBeDefined())

      expect(result.current.currentScopeData).toEqual(workflowData)
      expect(result.current.appWideScopeData).toBeUndefined()
    })
  })

  describe('query key uniqueness', () => {
    it('uses different query keys for app-wide and workflow', async () => {
      mockApiFetch.mockResolvedValue({})

      const { result: result1 } = renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })
      const { result: result2 } = renderHook(() => useScopedIntegrations('wf-123'), { wrapper: createWrapper() })

      await waitFor(() => expect(result1.current.currentScopeData).toBeDefined())
      await waitFor(() => expect(result2.current.currentScopeData).toBeDefined())

      expect(mockApiFetch).toHaveBeenCalledTimes(3)
    })

    it('uses workflow-specific query key', async () => {
      mockApiFetch.mockResolvedValue({})

      const { rerender } = renderHook(({ wfId }) => useScopedIntegrations(wfId), {
        wrapper: createWrapper(),
        initialProps: { wfId: 'wf-123' as string | null },
      })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())

      mockApiFetch.mockClear()
      rerender({ wfId: 'wf-456' })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
    })
  })

  describe('edge cases', () => {
    it('handles empty string workflowId as truthy', async () => {
      mockApiFetch.mockResolvedValue({})

      renderHook(() => useScopedIntegrations(''), { wrapper: createWrapper() })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2))
      expect(mockApiFetch).toHaveBeenCalledWith('/integration?workflowId=', { version: undefined })
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', { version: undefined })
    })

    it('handles special characters in workflowId', async () => {
      mockApiFetch.mockResolvedValue({})

      renderHook(() => useScopedIntegrations('wf-123_test@domain'), { wrapper: createWrapper() })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalled())
      expect(mockApiFetch).toHaveBeenCalledWith('/integration?workflowId=wf-123_test@domain', { version: undefined })
    })

    it('returns empty data initially before fetch completes', () => {
      mockApiFetch.mockImplementation(() => new Promise(() => {}))

      const { result } = renderHook(() => useScopedIntegrations(null), { wrapper: createWrapper() })

      expect(result.current.currentScopeData).toBeUndefined()
      expect(result.current.appWideScopeData).toBeUndefined()
      expect(result.current.isLoading).toBe(true)
    })
  })
})
