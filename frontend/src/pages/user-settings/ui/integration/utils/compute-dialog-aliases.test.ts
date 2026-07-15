import { describe, it, expect } from 'vitest'
import { computeDialogAliases } from './compute-dialog-aliases'
import type { IntegrationSettings, MCPIntegration, RPCIntegration } from '@shared/base-types'

const mcp = (alias: string): MCPIntegration => ({ alias, transport: 'stdio', toolName: 'test' })
const rpc = (alias: string): RPCIntegration => ({ alias, protocol: 'ssh', host: 'localhost' })

describe('computeDialogAliases', () => {
  describe('null / undefined inputs', () => {
    it('returns empty arrays when both inputs are undefined', () => {
      const result = computeDialogAliases(undefined, undefined)
      expect(result.mcpDialogAliases).toEqual([])
      expect(result.rpcDialogAliases).toEqual([])
    })

    it('returns empty arrays when data is undefined and inheritedData is empty object', () => {
      const result = computeDialogAliases(undefined, {})
      expect(result.mcpDialogAliases).toEqual([])
      expect(result.rpcDialogAliases).toEqual([])
    })

    it('returns empty arrays when data is empty object and inheritedData is undefined', () => {
      const result = computeDialogAliases({}, undefined)
      expect(result.mcpDialogAliases).toEqual([])
      expect(result.rpcDialogAliases).toEqual([])
    })

    it('handles data with no mcp/rpc arrays and non-empty inheritedData', () => {
      const inheritedData: IntegrationSettings = { mcp: [mcp('/a')], rpc: [rpc('/b')] }
      const result = computeDialogAliases({}, inheritedData)
      expect(result.mcpDialogAliases).toEqual(['/b'])
      expect(result.rpcDialogAliases).toEqual(['/a'])
    })

    it('handles data with mcp/rpc arrays and no inheritedData', () => {
      const data: IntegrationSettings = { mcp: [mcp('/m1')], rpc: [rpc('/r1')] }
      const result = computeDialogAliases(data, undefined)
      expect(result.mcpDialogAliases).toEqual(['/m1', '/r1'])
      expect(result.rpcDialogAliases).toEqual(['/m1', '/r1'])
    })
  })

  describe('own alias inclusion', () => {
    it('includes own MCP aliases in both dialog alias lists', () => {
      const data: IntegrationSettings = { mcp: [mcp('/qa'), mcp('/search')] }
      const result = computeDialogAliases(data, undefined)
      expect(result.mcpDialogAliases).toContain('/qa')
      expect(result.mcpDialogAliases).toContain('/search')
      expect(result.rpcDialogAliases).toContain('/qa')
      expect(result.rpcDialogAliases).toContain('/search')
    })

    it('includes own RPC aliases in both dialog alias lists', () => {
      const data: IntegrationSettings = { rpc: [rpc('/deploy'), rpc('/test')] }
      const result = computeDialogAliases(data, undefined)
      expect(result.mcpDialogAliases).toContain('/deploy')
      expect(result.mcpDialogAliases).toContain('/test')
      expect(result.rpcDialogAliases).toContain('/deploy')
      expect(result.rpcDialogAliases).toContain('/test')
    })

    it('includes own aliases of both types in both lists', () => {
      const data: IntegrationSettings = { mcp: [mcp('/m')], rpc: [rpc('/r')] }
      const result = computeDialogAliases(data, undefined)
      expect(result.mcpDialogAliases).toEqual(['/m', '/r'])
      expect(result.rpcDialogAliases).toEqual(['/m', '/r'])
    })
  })

  describe('cross-type inherited alias blocking', () => {
    it('includes inherited RPC aliases in mcpDialogAliases to block cross-type collision', () => {
      const inheritedData: IntegrationSettings = { rpc: [rpc('/shared')] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.mcpDialogAliases).toContain('/shared')
    })

    it('includes inherited MCP aliases in rpcDialogAliases to block cross-type collision', () => {
      const inheritedData: IntegrationSettings = { mcp: [mcp('/shared')] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.rpcDialogAliases).toContain('/shared')
    })

    it('does not include inherited RPC aliases in rpcDialogAliases (allows same-type override)', () => {
      const inheritedData: IntegrationSettings = { rpc: [rpc('/deploy')] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.rpcDialogAliases).not.toContain('/deploy')
    })

    it('does not include inherited MCP aliases in mcpDialogAliases (allows same-type override)', () => {
      const inheritedData: IntegrationSettings = { mcp: [mcp('/qa')] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.mcpDialogAliases).not.toContain('/qa')
    })
  })

  describe('same-type override semantics', () => {
    it('MCP dialog alias list excludes inherited MCP aliases so workflow MCP can override global MCP', () => {
      const data: IntegrationSettings = { mcp: [mcp('/other')] }
      const inheritedData: IntegrationSettings = { mcp: [mcp('/qa'), mcp('/search')] }
      const result = computeDialogAliases(data, inheritedData)
      expect(result.mcpDialogAliases).not.toContain('/qa')
      expect(result.mcpDialogAliases).not.toContain('/search')
      expect(result.mcpDialogAliases).toContain('/other')
    })

    it('RPC dialog alias list excludes inherited RPC aliases so workflow RPC can override global RPC', () => {
      const data: IntegrationSettings = { rpc: [rpc('/other')] }
      const inheritedData: IntegrationSettings = { rpc: [rpc('/deploy'), rpc('/test')] }
      const result = computeDialogAliases(data, inheritedData)
      expect(result.rpcDialogAliases).not.toContain('/deploy')
      expect(result.rpcDialogAliases).not.toContain('/test')
      expect(result.rpcDialogAliases).toContain('/other')
    })
  })

  describe('combined data and inheritedData', () => {
    it('mcpDialogAliases = own MCP + own RPC + inherited RPC', () => {
      const data: IntegrationSettings = { mcp: [mcp('/m1')], rpc: [rpc('/r1')] }
      const inheritedData: IntegrationSettings = { mcp: [mcp('/im1')], rpc: [rpc('/ir1')] }
      const result = computeDialogAliases(data, inheritedData)
      expect(result.mcpDialogAliases).toEqual(['/m1', '/r1', '/ir1'])
    })

    it('rpcDialogAliases = own MCP + own RPC + inherited MCP', () => {
      const data: IntegrationSettings = { mcp: [mcp('/m1')], rpc: [rpc('/r1')] }
      const inheritedData: IntegrationSettings = { mcp: [mcp('/im1')], rpc: [rpc('/ir1')] }
      const result = computeDialogAliases(data, inheritedData)
      expect(result.rpcDialogAliases).toEqual(['/m1', '/r1', '/im1'])
    })

    it('preserves ordering: own MCP, own RPC, then inherited cross-type', () => {
      const data: IntegrationSettings = { mcp: [mcp('/a'), mcp('/b')], rpc: [rpc('/c')] }
      const inheritedData: IntegrationSettings = { rpc: [rpc('/d'), rpc('/e')] }
      const result = computeDialogAliases(data, inheritedData)
      expect(result.mcpDialogAliases).toEqual(['/a', '/b', '/c', '/d', '/e'])
    })

    it('does not deduplicate when same alias appears in multiple sources', () => {
      const data: IntegrationSettings = { mcp: [mcp('/shared')], rpc: [rpc('/shared')] }
      const inheritedData: IntegrationSettings = { rpc: [rpc('/shared')] }
      const result = computeDialogAliases(data, inheritedData)
      expect(result.mcpDialogAliases.filter(a => a === '/shared').length).toBeGreaterThan(1)
    })
  })

  describe('multiple inherited aliases', () => {
    it('includes all inherited RPC aliases in mcpDialogAliases', () => {
      const inheritedData: IntegrationSettings = { rpc: [rpc('/r1'), rpc('/r2'), rpc('/r3')] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.mcpDialogAliases).toEqual(['/r1', '/r2', '/r3'])
    })

    it('includes all inherited MCP aliases in rpcDialogAliases', () => {
      const inheritedData: IntegrationSettings = { mcp: [mcp('/m1'), mcp('/m2'), mcp('/m3')] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.rpcDialogAliases).toEqual(['/m1', '/m2', '/m3'])
    })
  })

  describe('empty arrays in inputs', () => {
    it('handles empty mcp array in data gracefully', () => {
      const data: IntegrationSettings = { mcp: [], rpc: [rpc('/r1')] }
      const result = computeDialogAliases(data, undefined)
      expect(result.mcpDialogAliases).toEqual(['/r1'])
      expect(result.rpcDialogAliases).toEqual(['/r1'])
    })

    it('handles empty rpc array in data gracefully', () => {
      const data: IntegrationSettings = { mcp: [mcp('/m1')], rpc: [] }
      const result = computeDialogAliases(data, undefined)
      expect(result.mcpDialogAliases).toEqual(['/m1'])
      expect(result.rpcDialogAliases).toEqual(['/m1'])
    })

    it('handles empty mcp array in inheritedData gracefully', () => {
      const inheritedData: IntegrationSettings = { mcp: [], rpc: [rpc('/ir1')] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.mcpDialogAliases).toEqual(['/ir1'])
      expect(result.rpcDialogAliases).toEqual([])
    })

    it('handles empty rpc array in inheritedData gracefully', () => {
      const inheritedData: IntegrationSettings = { mcp: [mcp('/im1')], rpc: [] }
      const result = computeDialogAliases(undefined, inheritedData)
      expect(result.mcpDialogAliases).toEqual([])
      expect(result.rpcDialogAliases).toEqual(['/im1'])
    })
  })

  describe('return value immutability', () => {
    it('returns new arrays on each call (no shared references)', () => {
      const data: IntegrationSettings = { mcp: [mcp('/m1')] }
      const result1 = computeDialogAliases(data, undefined)
      const result2 = computeDialogAliases(data, undefined)
      expect(result1.mcpDialogAliases).not.toBe(result2.mcpDialogAliases)
      expect(result1.rpcDialogAliases).not.toBe(result2.rpcDialogAliases)
    })

    it('mutating the returned array does not affect subsequent calls', () => {
      const data: IntegrationSettings = { mcp: [mcp('/m1')] }
      const result1 = computeDialogAliases(data, undefined)
      result1.mcpDialogAliases.push('/injected')
      const result2 = computeDialogAliases(data, undefined)
      expect(result2.mcpDialogAliases).not.toContain('/injected')
    })
  })
})
