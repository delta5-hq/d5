import {MCP_TRANSPORT} from '../../constants/mcp'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'

/**
 * @param {{serverUrl: string, transport: string, headers?: Object}} config
 * @returns {import('@modelcontextprotocol/sdk/client/streamableHttp.js').StreamableHTTPClientTransport}
 */
export const createTransport = ({serverUrl, transport, headers}) => {
  switch (transport) {
    case MCP_TRANSPORT.STREAMABLE_HTTP: {
      const opts = headers ? {requestInit: {headers}} : undefined
      return new StreamableHTTPClientTransport(new URL(serverUrl), opts)
    }

    default:
      throw new Error(`Unknown MCP transport: ${transport}`)
  }
}
