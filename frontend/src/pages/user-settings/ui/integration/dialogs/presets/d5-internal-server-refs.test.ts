import { describe, expect, it } from 'vitest'
import internalMcpServerCatalog from '@contracts/internal-mcp-server-catalog.json'

import { D5_INTERNAL_MCP_SERVER_IDS, D5_INTERNAL_MCP_SERVERS } from './d5-internal-server-refs'

const internalServerRefs = Object.entries(D5_INTERNAL_MCP_SERVERS)
const internalServerIds = internalServerRefs.map(([_name, value]) => value.replace('d5-internal://mcp-server/', ''))
const contractServerIds = Object.keys(internalMcpServerCatalog).sort()

describe('D5 internal server references', () => {
  it('uses logical MCP server URIs instead of filesystem paths', () => {
    internalServerRefs.forEach(([_name, value]) => {
      expect(value).toMatch(/^d5-internal:\/\/mcp-server\/[a-z0-9-]+$/)
      expect(value).not.toMatch(/^\//)
      expect(value).not.toContain('/app')
      expect(value).not.toContain('backend/build')
    })
  })

  it('keeps logical MCP server ids unique and URI-safe', () => {
    const values = internalServerRefs.map(([_name, value]) => value)
    expect(new Set(values).size).toBe(values.length)
    internalServerIds.forEach(serverId => {
      expect(serverId).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    })
  })

  it('does not publish D5 backend filesystem paths for RPC SSH presets', async () => {
    const refs = await import('./d5-internal-server-refs')
    expect(refs).not.toHaveProperty('D5_REMOTE_BACKEND_ROOT')
    expect(refs).not.toHaveProperty('D5_BACKEND_PATHS')
  })

  it('stays aligned with backend executor internal MCP server catalog', () => {
    expect(D5_INTERNAL_MCP_SERVER_IDS).toEqual(contractServerIds)
    expect([...internalServerIds].sort()).toEqual(contractServerIds)
  })
})
