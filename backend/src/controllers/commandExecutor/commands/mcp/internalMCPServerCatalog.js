const INTERNAL_SERVER_URI_PREFIX = 'd5-internal://mcp-server/'
const INTERNAL_SERVER_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const INTERNAL_MCP_SERVER_CATALOG = Object.freeze({
  'research-rag': Object.freeze({script: 'research-rag/server.js'}),
  scraper: Object.freeze({script: 'scraper/server.js'}),
  outliner: Object.freeze({script: 'outliner/server.js'}),
})

export const buildInternalMCPServerUri = serverId => {
  if (!INTERNAL_SERVER_ID_PATTERN.test(serverId)) throw new Error(`Invalid internal MCP server id: ${serverId}`)
  return `${INTERNAL_SERVER_URI_PREFIX}${serverId}`
}

export const readInternalMCPServerId = value => {
  if (typeof value !== 'string') return null
  if (!value.startsWith(INTERNAL_SERVER_URI_PREFIX)) return null
  const serverId = value.slice(INTERNAL_SERVER_URI_PREFIX.length)
  return INTERNAL_SERVER_ID_PATTERN.test(serverId) ? serverId : null
}

export const resolveInternalMCPServerScript = serverId => {
  const server = INTERNAL_MCP_SERVER_CATALOG[serverId]
  if (!server) throw new Error(`Unknown internal MCP server: ${serverId}`)
  return server.script
}

export const listInternalMCPServerIds = () => Object.keys(INTERNAL_MCP_SERVER_CATALOG)
