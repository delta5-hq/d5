import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {createTransport} from './createTransport'
import {MCP_DEFAULT_TIMEOUT_MS} from '../../constants/mcp'

const CLIENT_INFO = {name: 'delta5-executor', version: '1.0.0'}

/**
 * @typedef {Object} MCPToolRequest
 * @property {string} serverUrl
 * @property {string} transport
 * @property {string} toolName
 * @property {Object} [toolArguments]
 * @property {Object} [headers]
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {Object} MCPToolResult
 * @property {boolean} isError
 * @property {string} content
 */

/**
 * @param {{serverUrl: string, transport: string, headers?: Object}} config
 * @param {(client: Client) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
const withClient = async ({serverUrl, transport, headers}, fn) => {
  const clientTransport = createTransport({serverUrl, transport, headers})
  const client = new Client(CLIENT_INFO)

  try {
    await client.connect(clientTransport)
    return await fn(client)
  } finally {
    await client.close().catch(() => {})
  }
}

/**
 * @param {MCPToolRequest} request
 * @returns {Promise<MCPToolResult>}
 */
export const callTool = async ({
  serverUrl,
  transport,
  toolName,
  toolArguments = {},
  headers,
  timeoutMs = MCP_DEFAULT_TIMEOUT_MS,
}) =>
  withClient({serverUrl, transport, headers}, async client => {
    const result = await client.callTool({name: toolName, arguments: toolArguments}, undefined, {
      timeout: timeoutMs,
    })
    return formatToolResult(result)
  })

/**
 * @param {{serverUrl: string, transport: string, headers?: Object}} config
 * @returns {Promise<Array<{name: string, description: string, inputSchema: Object}>>}
 */
export const listTools = async ({serverUrl, transport, headers}) =>
  withClient({serverUrl, transport, headers}, async client => {
    const {tools} = await client.listTools()
    return tools
  })

const formatToolResult = result => {
  if (!result?.content?.length) {
    return {isError: !!result?.isError, content: ''}
  }

  const textParts = result.content.filter(part => part.type === 'text').map(part => part.text)

  return {
    isError: !!result.isError,
    content: textParts.join('\n'),
  }
}
