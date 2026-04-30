/**
 * Echo MCP Server Test Stub
 *
 * Minimal MCP server that registers one tool 'echo' which returns its input unchanged.
 * Used for integration testing of MCPClientManager without external dependencies.
 *
 * Protocol: MCP (Model Context Protocol) over stdio
 * Transport: StdioServerTransport (JSON-RPC via stdin/stdout)
 */

const {McpServer} = require('@modelcontextprotocol/sdk/server/mcp.js')
const {StdioServerTransport} = require('@modelcontextprotocol/sdk/server/stdio.js')
const {z} = require('zod')

const server = new McpServer(
  {
    name: 'echo-test-stub',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.tool(
  'echo',
  'Echoes back the provided text unchanged',
  {
    text: z.string().optional().describe('Text to echo back'),
  },
  async ({text}) => ({
    content: [{type: 'text', text: text || ''}],
  }),
)

const transport = new StdioServerTransport()
server.connect(transport).catch(error => {
  process.stderr.write(`Echo MCP server failed to connect: ${error.message}\n`)
  process.exit(1)
})
