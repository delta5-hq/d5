import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {createTransport} from './createTransport'
import {MCP_DEFAULT_TIMEOUT_MS, MCP_CONNECTION_TIMEOUT_MS} from '../../constants/mcp'
import {withTimeout} from './withTimeout'

const CLIENT_INFO = {name: 'delta5-executor', version: '1.0.0'}

/**
 * @typedef {Object} MCPTransportConfig
 * @property {string} transport
 * @property {string} [serverUrl]
 * @property {Object} [headers]
 * @property {string} [command]
 * @property {string[]} [args]
 * @property {Object} [env]
 */

/**
 * @typedef {Object} MCPToolRequest
 * @property {string} transport
 * @property {string} toolName
 * @property {Object} [toolArguments]
 * @property {string} [serverUrl]
 * @property {Object} [headers]
 * @property {string} [command]
 * @property {string[]} [args]
 * @property {Object} [env]
 * @property {number} [timeoutMs]
 */

/**
 * @typedef {Object} MCPToolResult
 * @property {boolean} isError
 * @property {string} content
 */

/**
 * @param {MCPTransportConfig} config
 * @param {(client: Client) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export const withClient = async ({serverUrl, transport, headers, command, args, env}, fn) => {
  const clientTransport = createTransport({serverUrl, transport, headers, command, args, env})
  const client = new Client(CLIENT_INFO)

  try {
    await withTimeout(client.connect(clientTransport), MCP_CONNECTION_TIMEOUT_MS, 'MCP connection')
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
  command,
  args,
  env,
  timeoutMs = MCP_DEFAULT_TIMEOUT_MS,
}) =>
  withClient({serverUrl, transport, headers, command, args, env}, async client => {
    const result = await client.callTool({name: toolName, arguments: toolArguments}, undefined, {
      timeout: timeoutMs,
    })
    return formatToolResult(result)
  })

/**
 * @param {MCPTransportConfig} config
 * @returns {Promise<Array<{name: string, description: string, inputSchema: Object}>>}
 */
export const listTools = async ({serverUrl, transport, headers, command, args, env}) =>
  withClient({serverUrl, transport, headers, command, args, env}, async client => {
    const {tools} = await client.listTools()
    return tools
  })

const serializeContentPart = part => {
  if (part.type === 'text') return part.text
  if (part.type === 'image') return `![image](data:${part.mimeType};base64,${part.data})`
  if (part.type === 'resource') return `[resource: ${part.resource?.uri ?? ''}]`
  return null
}

export const formatToolResult = result => {
  if (!result?.content?.length) {
    return {isError: !!result?.isError, content: ''}
  }

  const parts = result.content.map(serializeContentPart).filter(p => p !== null)

  return {
    isError: !!result.isError,
    content: parts.join('\n'),
  }
}
