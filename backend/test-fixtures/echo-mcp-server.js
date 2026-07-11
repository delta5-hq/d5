#!/usr/bin/env node
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'

const mcpServer = new McpServer(
  {name: 'echo-test-server', version: '1.0.0'},
  {capabilities: {tools: {}}},
)

const echoToolSchema = {
  name: 'echo',
  description: 'Returns the input text as-is for testing',
  inputSchema: {
    type: 'object',
    properties: {
      text: {type: 'string', description: 'Text to echo back'},
    },
    required: ['text'],
  },
}

mcpServer.registerTool(echoToolSchema.name, echoToolSchema, async args => {
  const text = args?.text || ''
  return {
    content: [{type: 'text', text: `Echo: ${text}`}],
  }
})

const transport = new StdioServerTransport()
await mcpServer.connect(transport)
