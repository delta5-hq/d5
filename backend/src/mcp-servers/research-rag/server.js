import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import debug from 'debug'

import {EnvironmentValidator} from '../shared/bootstrap/EnvironmentValidator'
import {DatabaseConnector} from '../shared/bootstrap/DatabaseConnector'
import {ServerLifecycle} from '../shared/bootstrap/ServerLifecycle'
import {UserContextProvider} from '../shared/context/UserContextProvider'
import {CommandContextAdapter} from './context/CommandContextAdapter'
import {ToolRegistry} from './tools/ToolRegistry'

const log = debug('delta5:mcp:research-rag:server')

async function main() {
  const environmentValidator = new EnvironmentValidator(['D5_USER_ID'])
  const databaseConnector = new DatabaseConnector()
  const lifecycle = new ServerLifecycle(environmentValidator, databaseConnector, 'research-rag')

  lifecycle.registerExitHandlers()

  try {
    await lifecycle.startup()

    const userId = environmentValidator.getUserId()
    log(`Starting MCP server for user: ${userId}`)

    const userContextProvider = new UserContextProvider(userId)
    const commandContextAdapter = new CommandContextAdapter()
    const toolRegistry = new ToolRegistry(userContextProvider, commandContextAdapter)

    const mcpServer = new McpServer(
      {
        name: 'd5-research-rag',
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
