import {MCP_TRANSPORT} from '../../constants/mcp'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js'
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js'
import {sandboxSpawn} from '../sandbox/ProcessSandbox'

/**
 * @param {{serverUrl?: string, transport: string, headers?: Object, command?: string, args?: string[], env?: Object}} config
 * @returns {StreamableHTTPClientTransport | StdioClientTransport | SSEClientTransport}
 */
export const createTransport = ({serverUrl, transport, headers, command, args, env}) => {
  switch (transport) {
    case MCP_TRANSPORT.STREAMABLE_HTTP: {
      const opts = headers ? {requestInit: {headers}} : undefined
      return new StreamableHTTPClientTransport(new URL(serverUrl), opts)
    }

    case MCP_TRANSPORT.STDIO: {
      const sandboxed = sandboxSpawn(command, args, env, {allowNetwork: true})
      return new StdioClientTransport(sandboxed)
    }

    case MCP_TRANSPORT.SSE: {
      const opts = headers ? {headers} : undefined
      return new SSEClientTransport(new URL(serverUrl), opts)
    }

    default:
      throw new Error(`Unknown MCP transport: ${transport}`)
  }
}
