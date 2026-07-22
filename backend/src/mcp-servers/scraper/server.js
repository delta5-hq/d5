import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import debug from 'debug'

import {EnvironmentValidator} from '../shared/bootstrap/EnvironmentValidator'
import {ServerLifecycle} from '../shared/bootstrap/ServerLifecycle'
import {ToolRegistry} from './tools/ToolRegistry'

const log = debug('delta5:mcp:scraper:server')

async function main() {
  const environmentValidator = new EnvironmentValidator([])
  const lifecycle = new ServerLifecycle(environmentValidator, null, 'scraper')

  lifecycle.registerExitHandlers()

  try {
    await lifecycle.startup()

    log('Initializing scraper MCP server')

    const toolRegistry = new ToolRegistry()

    const mcpServer = new McpServer(
      {
        name: 'd5-scraper',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    toolRegistry.registerAll(mcpServer)

    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)

    log('MCP server connected and ready')
  } catch (error) {
    console.error('Failed to start MCP server:', error)
    await lifecycle.shutdown()
    process.exit(1)
  }
}

main()
