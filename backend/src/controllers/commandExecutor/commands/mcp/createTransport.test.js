import {MCP_TRANSPORT} from '../../constants/mcp'
import {createTransport} from './createTransport'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation(url => ({url, type: 'streamable-http'})),
}))

describe('createTransport', () => {
  afterEach(() => jest.clearAllMocks())

  describe('streamable-http transport', () => {
    it('creates StreamableHTTPClientTransport instance', () => {
      const transport = createTransport({
        serverUrl: 'http://localhost:3100/mcp',
        transport: MCP_TRANSPORT.STREAMABLE_HTTP,
      })

      expect(transport.type).toBe('streamable-http')
    })

    it('passes URL object to transport constructor', () => {
      createTransport({
        serverUrl: 'http://localhost:3100/mcp',
        transport: MCP_TRANSPORT.STREAMABLE_HTTP,
      })

      expect(StreamableHTTPClientTransport).toHaveBeenCalledTimes(1)
      const urlArg = StreamableHTTPClientTransport.mock.calls[0][0]
      expect(urlArg).toBeInstanceOf(URL)
      expect(urlArg.href).toBe('http://localhost:3100/mcp')
    })

    it('passes no options when headers are absent', () => {
      createTransport({
        serverUrl: 'http://localhost:3100/mcp',
        transport: MCP_TRANSPORT.STREAMABLE_HTTP,
      })

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(expect.any(URL), undefined)
    })

    it('passes requestInit with headers when provided', () => {
      createTransport({
        serverUrl: 'http://localhost:3100/mcp',
        transport: MCP_TRANSPORT.STREAMABLE_HTTP,
        headers: {Authorization: 'Bearer tok'},
      })

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(expect.any(URL), {
        requestInit: {headers: {Authorization: 'Bearer tok'}},
      })
    })

    it('passes requestInit when headers is empty object', () => {
      createTransport({
        serverUrl: 'http://localhost:3100/mcp',
        transport: MCP_TRANSPORT.STREAMABLE_HTTP,
        headers: {},
      })

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(expect.any(URL), {
        requestInit: {headers: {}},
      })
    })

    it('passes multiple headers through requestInit', () => {
      createTransport({
        serverUrl: 'http://localhost:3100/mcp',
        transport: MCP_TRANSPORT.STREAMABLE_HTTP,
        headers: {Authorization: 'Bearer tok', 'X-Api-Key': 'abc'},
      })

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(expect.any(URL), {
        requestInit: {headers: {Authorization: 'Bearer tok', 'X-Api-Key': 'abc'}},
      })
    })

    it('throws on invalid URL', () => {
      expect(() =>
        createTransport({
          serverUrl: 'not a url',
          transport: MCP_TRANSPORT.STREAMABLE_HTTP,
        }),
      ).toThrow()
    })
  })

  describe('unknown transport', () => {
    it('throws with the unrecognized transport type in the message', () => {
      expect(() =>
        createTransport({
          serverUrl: 'http://localhost:3100',
          transport: 'carrier-pigeon',
        }),
      ).toThrow('Unknown MCP transport: carrier-pigeon')
    })

    it('throws for empty transport string', () => {
      expect(() =>
        createTransport({
          serverUrl: 'http://localhost:3100',
          transport: '',
        }),
      ).toThrow('Unknown MCP transport: ')
    })

    it('throws for undefined transport', () => {
      expect(() =>
        createTransport({
          serverUrl: 'http://localhost:3100',
          transport: undefined,
        }),
      ).toThrow('Unknown MCP transport')
    })
  })
})
