import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import { AliasProvider, useAliases } from '../alias-context'
import type { IntegrationSettings, MCPIntegration, RPCIntegration } from '@shared/base-types'

const mockApiFetch = vi.fn()

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

const authState = { isLoggedIn: false }

vi.mock('@entities/auth', () => ({
  useAuthContext: () => authState,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AliasProvider, null, children),
    )
  }
}

const mcpWith = (alias: string, description?: string): MCPIntegration => ({
  alias,
  transport: 'stdio',
  toolName: 'tool',
  description,
})

const rpcWith = (alias: string, description?: string): RPCIntegration => ({
  alias,
  protocol: 'http',
  description,
})

const integrationWith = (overrides: Partial<IntegrationSettings> = {}): IntegrationSettings => overrides

describe('AliasProvider', () => {
  beforeEach(() => {
    authState.isLoggedIn = false
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('integration query gating on auth state', () => {
    it('does not issue a request to /integration while the user is not logged in', () => {
      authState.isLoggedIn = false

      renderHook(() => useAliases(), { wrapper: createWrapper() })

      expect(mockApiFetch).not.toHaveBeenCalled()
    })

    it('issues exactly one request to /integration once the user is logged in', async () => {
      authState.isLoggedIn = true
      mockApiFetch.mockResolvedValue(integrationWith())

      renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
      expect(mockApiFetch).toHaveBeenCalledWith('/integration', expect.any(Object))
    })

    it('fires the request after isLoggedIn transitions from false to true', async () => {
      authState.isLoggedIn = false
      mockApiFetch.mockResolvedValue(integrationWith())

      const { rerender } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      expect(mockApiFetch).not.toHaveBeenCalled()

      await act(async () => {
        authState.isLoggedIn = true
        rerender()
      })

      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))
    })

    it('suppresses the request when isLoggedIn reverts to false after being true', async () => {
      authState.isLoggedIn = true
      mockApiFetch.mockResolvedValue(integrationWith())

      const { rerender } = renderHook(() => useAliases(), { wrapper: createWrapper() })
      await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(1))

      mockApiFetch.mockClear()

      await act(async () => {
        authState.isLoggedIn = false
        rerender()
      })

      expect(mockApiFetch).not.toHaveBeenCalled()
    })
  })

  describe('isLoading state', () => {
    it('is false immediately when the user is not logged in (no pending query)', () => {
      authState.isLoggedIn = false

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      expect(result.current.isLoading).toBe(false)
    })

    it('is true while the integration fetch is in flight', () => {
      authState.isLoggedIn = true
      mockApiFetch.mockReturnValue(new Promise(() => {}))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      expect(result.current.isLoading).toBe(true)
    })

    it('is false once the integration fetch resolves', async () => {
      authState.isLoggedIn = true
      mockApiFetch.mockResolvedValue(integrationWith())

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('is false once the integration fetch rejects', async () => {
      authState.isLoggedIn = true
      mockApiFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })
  })

  describe('MCP alias extraction', () => {
    beforeEach(() => {
      authState.isLoggedIn = true
    })

    it('extracts a single MCP alias', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/search')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].alias).toBe('/search')
    })

    it('sets queryType to mcp:<alias-without-leading-slash>', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/search')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].queryType).toBe('mcp:search')
    })

    it('preserves the alias field verbatim including leading slash', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/my-tool')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].alias).toBe('/my-tool')
    })

    it('strips only the leading slash from queryType, leaving the rest intact', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/deep/path')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].queryType).toBe('mcp:deep/path')
    })

    it('handles an alias without a leading slash', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('notool')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].queryType).toBe('mcp:notool')
    })

    it('forwards the description from the MCP item', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/search', 'Web search')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].description).toBe('Web search')
    })

    it('forwards undefined description when MCP item has no description', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/search')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].description).toBeUndefined()
    })

    it('extracts multiple MCP aliases in order', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/alpha'), mcpWith('/beta'), mcpWith('/gamma')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(3))
      expect(result.current.aliases.map(a => a.alias)).toEqual(['/alpha', '/beta', '/gamma'])
    })

    it('skips MCP items with no alias field', async () => {
      const itemWithoutAlias = { ...mcpWith('placeholder'), alias: '' }
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [itemWithoutAlias, mcpWith('/valid')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].alias).toBe('/valid')
    })

    it('produces no aliases when the mcp array is empty', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })

    it('produces no aliases when the mcp field is absent', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })
  })

  describe('RPC alias extraction', () => {
    beforeEach(() => {
      authState.isLoggedIn = true
    })

    it('extracts a single RPC alias', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [rpcWith('/deploy')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].alias).toBe('/deploy')
    })

    it('sets queryType to rpc:<alias-without-leading-slash>', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [rpcWith('/deploy')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].queryType).toBe('rpc:deploy')
    })

    it('preserves the alias field verbatim including leading slash', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [rpcWith('/my-rpc')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].alias).toBe('/my-rpc')
    })

    it('forwards the description from the RPC item', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [rpcWith('/deploy', 'Deploy pipeline')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].description).toBe('Deploy pipeline')
    })

    it('extracts multiple RPC aliases in order', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [rpcWith('/a'), rpcWith('/b'), rpcWith('/c')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(3))
      expect(result.current.aliases.map(a => a.alias)).toEqual(['/a', '/b', '/c'])
    })

    it('skips RPC items with no alias field', async () => {
      const itemWithoutAlias = { ...rpcWith('placeholder'), alias: '' }
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [itemWithoutAlias, rpcWith('/valid')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].alias).toBe('/valid')
    })

    it('produces no aliases when the rpc array is empty', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ rpc: [] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })

    it('produces no aliases when the rpc field is absent', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })
  })

  describe('combined MCP and RPC aliases', () => {
    beforeEach(() => {
      authState.isLoggedIn = true
    })

    it('produces aliases from both MCP and RPC sources', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/search')], rpc: [rpcWith('/deploy')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(2))
    })

    it('places MCP aliases before RPC aliases', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/mcp-tool')], rpc: [rpcWith('/rpc-tool')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(2))
      expect(result.current.aliases[0].queryType).toMatch(/^mcp:/)
      expect(result.current.aliases[1].queryType).toMatch(/^rpc:/)
    })

    it('produces no aliases when both sources are empty', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [], rpc: [] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })

    it('produces only MCP aliases when RPC is empty', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [mcpWith('/search')], rpc: [] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].queryType).toMatch(/^mcp:/)
    })

    it('produces only RPC aliases when MCP is empty', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ mcp: [], rpc: [rpcWith('/deploy')] }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(1))
      expect(result.current.aliases[0].queryType).toMatch(/^rpc:/)
    })
  })

  describe('integration response edge cases', () => {
    beforeEach(() => {
      authState.isLoggedIn = true
    })

    it('produces no aliases when the integration response has no mcp or rpc fields', async () => {
      mockApiFetch.mockResolvedValue(integrationWith({ openai: { apiKey: 'key', model: 'gpt-4' } }))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })

    it('produces no aliases when the fetch resolves with an empty object', async () => {
      mockApiFetch.mockResolvedValue({})

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })

    it('does not throw when mcp items interleave aliased and non-aliased entries', async () => {
      mockApiFetch.mockResolvedValue(
        integrationWith({
          mcp: [mcpWith('/a'), { ...mcpWith('placeholder'), alias: '' }, mcpWith('/b')],
        }),
      )

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.aliases).toHaveLength(2))
      expect(result.current.aliases.map(a => a.alias)).toEqual(['/a', '/b'])
    })
  })

  describe('fetch error handling', () => {
    beforeEach(() => {
      authState.isLoggedIn = true
    })

    it('produces an empty alias list when the fetch rejects', async () => {
      mockApiFetch.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAliases(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.aliases).toHaveLength(0)
    })

    it('does not throw to the caller when the fetch rejects', async () => {
      mockApiFetch.mockRejectedValue(new Error('Unauthorized'))

      await expect(
        act(async () => {
          renderHook(() => useAliases(), { wrapper: createWrapper() })
        }),
      ).resolves.not.toThrow()
    })
  })
})

describe('useAliases', () => {
  it('throws a descriptive error when used outside AliasProvider', () => {
    expect(() => renderHook(() => useAliases())).toThrow('useAliases must be used within an AliasProvider')
  })
})
