import internalMcpServerCatalog from '@contracts/internal-mcp-server-catalog.json'

const INTERNAL_MCP_SERVER_URI_PREFIX = 'd5-internal://mcp-server/'

const internalMcpServerUri = (serverId: string): string => `${INTERNAL_MCP_SERVER_URI_PREFIX}${serverId}`

export const D5_INTERNAL_MCP_SERVERS = {
  researchRag: internalMcpServerUri('research-rag'),
  scraper: internalMcpServerUri('scraper'),
  outliner: internalMcpServerUri('outliner'),
} as const

export const D5_INTERNAL_MCP_SERVER_IDS = Object.keys(internalMcpServerCatalog).sort()
