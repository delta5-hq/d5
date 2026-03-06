import {MCP_TRANSPORT} from '../../constants/mcp'
import {createTransport} from './createTransport'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js'
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js'

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation(url => ({url, type: 'streamable-http'})),
}))

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation(params => ({params, type: 'stdio'})),
}))

jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn().mockImplementation(url => ({url, type: 'sse'})),
}))

describe('createTransport', () => {
  afterEach(() => jest.clearAllMocks())

  describe('streamable-http transport', () => {
    it('passes a URL object constructed from serverUrl', () => {
      createTransport({serverUrl: 'http://localhost:3100/mcp', transport: MCP_TRANSPORT.STREAMABLE_HTTP})

      expect(StreamableHTTPClientTransport).toHaveBeenCalledTimes(1)
      const urlArg = StreamableHTTPClientTransport.mock.calls[0][0]
      expect(urlArg).toBeInstanceOf(URL)
      expect(urlArg.href).toBe('http://localhost:3100/mcp')
    })

    it('passes no options when headers are absent', () => {
      createTransport({serverUrl: 'http://localhost:3100/mcp', transport: MCP_TRANSPORT.STREAMABLE_HTTP})

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(expect.any(URL), undefined)
    })

    it.each([
      ['single header', {Authorization: 'Bearer tok'}],
      ['multiple headers', {Authorization: 'Bearer tok', 'X-Api-Key': 'abc'}],
      ['empty headers object', {}],
    ])('wraps headers in requestInit when provided — %s', (_label, headers) => {
      createTransport({serverUrl: 'http://localhost:3100/mcp', transport: MCP_TRANSPORT.STREAMABLE_HTTP, headers})

      expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(expect.any(URL), {requestInit: {headers}})
    })

    it('throws on an unparseable serverUrl', () => {
      expect(() => createTransport({serverUrl: 'not a url', transport: MCP_TRANSPORT.STREAMABLE_HTTP})).toThrow()
    })
  })

  describe('stdio transport', () => {
    it('passes command, args and env directly to StdioClientTransport', () => {
      createTransport({
        transport: MCP_TRANSPORT.STDIO,
        command: 'npx',
        args: ['-y', '@anthropic/mcp-server'],
        env: {API_KEY: 'secret'},
      })

      expect(StdioClientTransport).toHaveBeenCalledWith({
        command: 'npx',
        args: ['-y', '@anthropic/mcp-server'],
        env: {API_KEY: 'secret'},
      })
    })

    it.each([
      ['args omitted', {command: 'agent'}],
      ['env omitted', {command: 'agent', args: ['--run']}],
      ['both omitted', {command: 'agent'}],
    ])('passes undefined for omitted optional stdio params — %s', (_label, extra) => {
      createTransport({transport: MCP_TRANSPORT.STDIO, ...extra})

      expect(StdioClientTransport).toHaveBeenCalledWith(expect.objectContaining({command: 'agent'}))
    })

    it('does not invoke other transports', () => {
      createTransport({transport: MCP_TRANSPORT.STDIO, command: 'agent'})

      expect(StdioClientTransport).toHaveBeenCalledTimes(1)
      expect(StreamableHTTPClientTransport).not.toHaveBeenCalled()
      expect(SSEClientTransport).not.toHaveBeenCalled()
    })
  })

  describe('sse transport', () => {
    it('passes a URL object constructed from serverUrl', () => {
      createTransport({serverUrl: 'http://localhost:3100/sse', transport: MCP_TRANSPORT.SSE})

      expect(SSEClientTransport).toHaveBeenCalledTimes(1)
      const urlArg = SSEClientTransport.mock.calls[0][0]
      expect(urlArg).toBeInstanceOf(URL)
      expect(urlArg.href).toBe('http://localhost:3100/sse')
    })

    it('passes no options when headers are absent', () => {
      createTransport({serverUrl: 'http://localhost:3100/sse', transport: MCP_TRANSPORT.SSE})

      expect(SSEClientTransport).toHaveBeenCalledWith(expect.any(URL), undefined)
    })

    it.each([
      ['single header', {Authorization: 'Bearer tok'}],
      ['multiple headers', {Authorization: 'Bearer tok', 'X-Api-Key': 'abc'}],
      ['empty headers object', {}],
    ])('wraps headers in opts when provided — %s', (_label, headers) => {
      createTransport({serverUrl: 'http://localhost:3100/sse', transport: MCP_TRANSPORT.SSE, headers})

      expect(SSEClientTransport).toHaveBeenCalledWith(expect.any(URL), {headers})
    })

    it('throws on an unparseable serverUrl', () => {
      expect(() => createTransport({serverUrl: 'not a url', transport: MCP_TRANSPORT.SSE})).toThrow()
    })

    it('does not use stdio params', () => {
      createTransport({serverUrl: 'http://localhost:3100/sse', transport: MCP_TRANSPORT.SSE})

      expect(SSEClientTransport).toHaveBeenCalledTimes(1)
      expect(StdioClientTransport).not.toHaveBeenCalled()
      expect(StreamableHTTPClientTransport).not.toHaveBeenCalled()
    })

    it.each([
      ['https URL', 'https://secure.example.com/sse', 'https://secure.example.com/sse'],
      ['URL with port', 'http://localhost:8080/events', 'http://localhost:8080/events'],
      ['URL with path segments', 'http://api.example.com/v1/mcp/sse', 'http://api.example.com/v1/mcp/sse'],
      ['URL with query params', 'http://localhost:3100/sse?token=abc', 'http://localhost:3100/sse?token=abc'],
    ])('constructs URL correctly for %s', (_label, serverUrl, expectedHref) => {
      createTransport({serverUrl, transport: MCP_TRANSPORT.SSE})

      const urlArg = SSEClientTransport.mock.calls[0][0]
      expect(urlArg.href).toBe(expectedHref)
    })
  })

  describe('unknown transport', () => {
    it.each([
      ['unrecognized name', 'carrier-pigeon', 'Unknown MCP transport: carrier-pigeon'],
      ['empty string', '', 'Unknown MCP transport: '],
      ['undefined', undefined, 'Unknown MCP transport'],
      ['null', null, 'Unknown MCP transport'],
      ['numeric', 123, 'Unknown MCP transport'],
    ])('throws for %s', (_label, transport, expectedMessage) => {
      expect(() => createTransport({serverUrl: 'http://localhost:3100', transport})).toThrow(expectedMessage)
    })
  })
})
