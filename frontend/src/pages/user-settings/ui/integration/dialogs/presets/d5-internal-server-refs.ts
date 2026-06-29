const INTERNAL_MCP_SERVER_URI_PREFIX = 'd5-internal://mcp-server/'

const internalMcpServerCatalog = {
  researchRag: { id: 'research-rag', script: 'mcp-servers/research-rag/server.js' },
  scraper: { id: 'scraper', script: 'mcp-servers/scraper/server.js' },
  outliner: { id: 'outliner', script: 'mcp-servers/outliner/server.js' },
} as const

const internalMcpServerUri = (serverId: string): string => `${INTERNAL_MCP_SERVER_URI_PREFIX}${serverId}`

export const D5_INTERNAL_MCP_SERVERS = {
  researchRag: internalMcpServerUri(internalMcpServerCatalog.researchRag.id),
  scraper: internalMcpServerUri(internalMcpServerCatalog.scraper.id),
  outliner: internalMcpServerUri(internalMcpServerCatalog.outliner.id),
} as const
