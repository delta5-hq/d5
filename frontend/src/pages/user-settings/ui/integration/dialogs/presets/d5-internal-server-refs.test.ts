import { describe, expect, it } from 'vitest'
import { D5_BACKEND_PATHS, D5_INTERNAL_MCP_SERVERS, D5_REMOTE_BACKEND_ROOT } from './d5-internal-server-refs'

const internalServerRefs = Object.entries(D5_INTERNAL_MCP_SERVERS)
const backendPaths = Object.entries(D5_BACKEND_PATHS)
const internalServerIds = internalServerRefs.map(([_name, value]) => value.replace('d5-internal://mcp-server/', ''))

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

  it('keeps backend CLI paths relative so SSH targets own their filesystem root', () => {
    backendPaths.forEach(([_name, value]) => {
      expect(value).toMatch(/^mcp-servers\//)
      expect(value).not.toMatch(/^\//)
      expect(value).not.toContain('..')
      expect(value.trim()).toBe(value)
    })
  })

  it('keeps one relative CLI script path for each logical internal server id', () => {
    internalServerIds.forEach(serverId => {
      expect(Object.values(D5_BACKEND_PATHS)).toContain(`mcp-servers/${serverId}/server.js`)
    })
  })

  it('makes remote backend root a shell-side requirement instead of a frontend build path', () => {
    expect(D5_REMOTE_BACKEND_ROOT).toContain('D5_BACKEND_ROOT')
    expect(D5_REMOTE_BACKEND_ROOT).not.toContain('/app')
    expect(D5_REMOTE_BACKEND_ROOT).not.toContain('backend/build')
  })
})
