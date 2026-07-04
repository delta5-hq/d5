import internalMCPServerContract from '../../../../../../shared-contracts/internal-mcp-server-catalog.json'

import {
  buildInternalMCPServerUri,
  listInternalMCPServerIds,
  readInternalMCPServerId,
  resolveInternalMCPServerScript,
} from './internalMCPServerCatalog'

const knownServers = Object.entries(internalMCPServerContract).map(([serverId, server]) => [serverId, server.script])
const knownServerIds = knownServers.map(([id]) => id)
const knownScripts = knownServers.map(([, script]) => script)

describe('internalMCPServerCatalog', () => {
  it('lists every backend-owned internal MCP server id', () => {
    expect(listInternalMCPServerIds().sort()).toEqual([...knownServerIds].sort())
  })

  it('keeps server ids unique, lowercase, and URI-safe', () => {
    expect(new Set(knownServerIds).size).toBe(knownServerIds.length)
    knownServerIds.forEach(serverId => {
      expect(serverId).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    })
  })

  it('keeps script paths relative to the internal MCP server root', () => {
    knownScripts.forEach(script => {
      expect(script).toMatch(/^[a-z0-9-]+\/server\.js$/)
      expect(script).not.toContain('..')
      expect(script).not.toMatch(/^\//)
    })
  })

  it.each(knownServers)('builds and reads stable URI for %s', serverId => {
    const uri = buildInternalMCPServerUri(serverId)
    expect(uri).toBe(`d5-internal://mcp-server/${serverId}`)
    expect(readInternalMCPServerId(uri)).toBe(serverId)
  })

  it.each(knownServers)('resolves script path for %s', (serverId, script) => {
    expect(resolveInternalMCPServerScript(serverId)).toBe(script)
  })

  it.each([
    '/app/mcp-servers/scraper/server.js',
    'http://localhost/mcp-server/scraper',
    'd5-internal://other/scraper',
    'd5-internal://mcp-server/',
    'd5-internal://mcp-server/scraper/extra',
    'd5-internal://mcp-server/scraper?debug=1',
    '',
    null,
    undefined,
  ])('ignores non-internal URI value %p', value => {
    expect(readInternalMCPServerId(value)).toBeNull()
  })

  it.each(['', 'scraper/server.js', '../scraper', 'Scraper', 'scraper?debug=1'])(
    'rejects invalid server id %p before URI creation',
    serverId => {
      expect(() => buildInternalMCPServerUri(serverId)).toThrow('Invalid internal MCP server id')
    },
  )

  it.each(['missing', 'scraper-extra'])('rejects well-formed but unknown server id %p', serverId => {
    expect(() => resolveInternalMCPServerScript(serverId)).toThrow('Unknown internal MCP server')
  })
})
