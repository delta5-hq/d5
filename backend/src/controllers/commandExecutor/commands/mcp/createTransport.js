import {MCP_TRANSPORT} from '../../constants/mcp'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js'

/**
 * @param {{serverUrl?: string, transport: string, headers?: Object, command?: string, args?: string[], env?: Object}} config
 * @returns {StreamableHTTPClientTransport | StdioClientTransport}
 */
export const createTransport = ({serverUrl, transport, headers, command, args, env}) => {
  switch (transport) {
    case MCP_TRANSPORT.STREAMABLE_HTTP: {
      const opts = headers ? {requestInit: {headers}} : undefined
      return new StreamableHTTPClientTransport(new URL(serverUrl), opts)
    }

    case MCP_TRANSPORT.STDIO:
      return new StdioClientTransport({command, args, env})

    default:
      throw new Error(`Unknown MCP transport: ${transport}`)
  }
}
