import {callTool, listTools, withClient, formatToolResult} from './MCPClientManager'
import {createTransport} from './createTransport'
import {MCP_DEFAULT_TIMEOUT_MS, MCP_CONNECTION_TIMEOUT_MS} from '../../constants/mcp'
import {TimeoutError} from './withTimeout'

const mockCallTool = jest.fn()
const mockListTools = jest.fn()
const mockConnect = jest.fn()
const mockClose = jest.fn()

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    callTool: mockCallTool,
    listTools: mockListTools,
    close: mockClose,
  })),
}))

jest.mock('./createTransport', () => ({
  createTransport: jest.fn().mockReturnValue({type: 'mock-transport'}),
}))

const baseRequest = {serverUrl: 'http://srv:3100', transport: 'streamable-http', toolName: 'execute'}

describe('MCPClientManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConnect.mockResolvedValue(undefined)
    mockClose.mockResolvedValue(undefined)
  })

  describe('withClient', () => {
    it('connects before calling fn and closes after', async () => {
      const order = []
      mockConnect.mockImplementation(() => Promise.resolve(order.push('connect')))
      const fn = jest.fn().mockImplementation(() => Promise.resolve(order.push('fn')))
      mockClose.mockImplementation(() => Promise.resolve(order.push('close')))

      await withClient({serverUrl: 'http://srv', transport: 'streamable-http'}, fn)

      expect(order).toEqual(['connect', 'fn', 'close'])
    })

    it('returns the value produced by fn', async () => {
      const result = await withClient(
        {serverUrl: 'http://srv', transport: 'streamable-http'},
        jest.fn().mockResolvedValue('expected'),
      )

      expect(result).toBe('expected')
    })

    it('closes client even when fn rejects', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fn failed'))

      await expect(withClient({serverUrl: 'http://srv', transport: 'streamable-http'}, fn)).rejects.toThrow('fn failed')

      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('closes client even when connect rejects', async () => {
      mockConnect.mockRejectedValue(new Error('connect failed'))

      await expect(withClient({serverUrl: 'http://srv', transport: 'streamable-http'}, jest.fn())).rejects.toThrow(
        'connect failed',
      )

      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('rejects with TimeoutError when connection takes longer than MCP_CONNECTION_TIMEOUT_MS', async () => {
      mockConnect.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, MCP_CONNECTION_TIMEOUT_MS + 1000)),
      )

      await expect(withClient({serverUrl: 'http://srv', transport: 'streamable-http'}, jest.fn())).rejects.toThrow(
        TimeoutError,
      )
    })

    it('includes timeout duration in TimeoutError when connection times out', async () => {
      mockConnect.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, MCP_CONNECTION_TIMEOUT_MS + 1000)),
      )

      await expect(withClient({serverUrl: 'http://srv', transport: 'streamable-http'}, jest.fn())).rejects.toThrow(
        `MCP connection timed out after ${MCP_CONNECTION_TIMEOUT_MS}ms`,
      )
    })

    it('forwards all transport config fields to createTransport', async () => {
      await withClient(
        {transport: 'stdio', command: 'claude', args: ['mcp', 'serve'], env: {X: '1'}},
        jest.fn().mockResolvedValue(undefined),
      )

      expect(createTransport).toHaveBeenCalledWith(
        expect.objectContaining({transport: 'stdio', command: 'claude', args: ['mcp', 'serve'], env: {X: '1'}}),
      )
    })
  })

  describe('callTool', () => {
    describe('lifecycle', () => {
      it('swallows close failure so the result is still returned', async () => {
        mockCallTool.mockResolvedValue({content: [{type: 'text', text: 'ok'}], isError: false})
        mockClose.mockRejectedValue(new Error('close failure'))

        const result = await callTool(baseRequest)

        expect(result.content).toBe('ok')
      })
    })

    describe('arguments', () => {
      it('uses MCP_DEFAULT_TIMEOUT_MS when timeoutMs is not specified', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool(baseRequest)

        expect(mockCallTool).toHaveBeenCalledWith(expect.any(Object), undefined, {timeout: MCP_DEFAULT_TIMEOUT_MS})
      })

      it('passes custom timeoutMs through to the SDK client', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool({...baseRequest, timeoutMs: 5000})

        expect(mockCallTool).toHaveBeenCalledWith(expect.any(Object), undefined, {timeout: 5000})
      })

      it('defaults toolArguments to empty object when omitted', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool(baseRequest)

        expect(mockCallTool).toHaveBeenCalledWith({name: 'execute', arguments: {}}, undefined, expect.any(Object))
      })

      it('passes provided toolArguments through unchanged', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool({...baseRequest, toolArguments: {prompt: 'hello', mode: 'fast'}})

        expect(mockCallTool).toHaveBeenCalledWith(
          {name: 'execute', arguments: {prompt: 'hello', mode: 'fast'}},
          undefined,
          expect.any(Object),
        )
      })

      it.each([
        [
          'streamable-http with headers',
          {headers: {Authorization: 'Bearer tok'}},
          {headers: {Authorization: 'Bearer tok'}},
        ],
        ['streamable-http without headers', {}, {headers: undefined}],
        [
          'stdio with command/args/env',
          {transport: 'stdio', command: 'agent', args: ['--run'], env: {K: 'v'}},
          {transport: 'stdio', command: 'agent', args: ['--run'], env: {K: 'v'}},
        ],
      ])('forwards transport config to createTransport — %s', async (_label, extra, expectedFields) => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool({...baseRequest, ...extra})

        expect(createTransport).toHaveBeenCalledWith(expect.objectContaining(expectedFields))
      })
    })
  })

  describe('listTools', () => {
    it('returns tool descriptors from the server', async () => {
      const tools = [
        {name: 'toolA', description: 'A', inputSchema: {}},
        {name: 'toolB', description: 'B', inputSchema: {type: 'object'}},
      ]
      mockListTools.mockResolvedValue({tools})

      expect(await listTools({serverUrl: 'http://srv:3100', transport: 'streamable-http'})).toEqual(tools)
    })

    it('returns empty array when server exposes no tools', async () => {
      mockListTools.mockResolvedValue({tools: []})

      expect(await listTools({serverUrl: 'http://srv:3100', transport: 'streamable-http'})).toEqual([])
    })

    it.each([
      [
        'streamable-http with headers',
        {serverUrl: 'http://srv', transport: 'streamable-http', headers: {'X-Api-Key': 'k'}},
        {headers: {'X-Api-Key': 'k'}},
      ],
      [
        'stdio with command/args',
        {transport: 'stdio', command: 'my-agent', args: ['--list']},
        {transport: 'stdio', command: 'my-agent', args: ['--list']},
      ],
    ])('forwards transport config to createTransport — %s', async (_label, config, expectedFields) => {
      mockListTools.mockResolvedValue({tools: []})

      await listTools(config)

      expect(createTransport).toHaveBeenCalledWith(expect.objectContaining(expectedFields))
    })
  })

  describe('formatToolResult', () => {
    describe('empty / null results', () => {
      it.each([
        ['null result', null],
        ['undefined result', undefined],
        ['result with no content property', {isError: false}],
        ['result with empty content array', {content: [], isError: false}],
      ])('returns empty content for %s', (_label, result) => {
        expect(formatToolResult(result).content).toBe('')
      })

      it.each([
        ['null result', null],
        ['undefined result', undefined],
        ['result with no content property', {isError: false}],
      ])('returns isError false for %s', (_label, result) => {
        expect(formatToolResult(result).isError).toBe(false)
      })
    })

    describe('text parts', () => {
      it('extracts text from a single text part', () => {
        expect(formatToolResult({content: [{type: 'text', text: 'result'}]}).content).toBe('result')
      })

      it('joins multiple text parts with newline', () => {
        const result = formatToolResult({
          content: [
            {type: 'text', text: 'line 1'},
            {type: 'text', text: 'line 2'},
          ],
        })
        expect(result.content).toBe('line 1\nline 2')
      })

      it('preserves empty-string text parts as blank lines in the join', () => {
        const result = formatToolResult({
          content: [
            {type: 'text', text: 'first'},
            {type: 'text', text: ''},
            {type: 'text', text: 'third'},
          ],
        })
        expect(result.content).toBe('first\n\nthird')
      })
    })

    describe('image parts', () => {
      it('serializes an image part as a markdown image with base64 data URI', () => {
        const result = formatToolResult({content: [{type: 'image', mimeType: 'image/png', data: 'abc123'}]})
        expect(result.content).toBe('![image](data:image/png;base64,abc123)')
      })
    })

    describe('resource parts', () => {
      it('serializes a resource part as a markdown link with its URI', () => {
        const result = formatToolResult({content: [{type: 'resource', resource: {uri: 'file:///path/to/file.ts'}}]})
        expect(result.content).toBe('[resource: file:///path/to/file.ts]')
      })

      it.each([
        ['resource object with no uri', {type: 'resource', resource: {}}],
        ['resource part with no resource object', {type: 'resource'}],
      ])('falls back to empty uri for %s', (_label, part) => {
        expect(formatToolResult({content: [part]}).content).toBe('[resource: ]')
      })
    })

    describe('mixed and unknown parts', () => {
      it('interleaves text, image and resource parts in source order', () => {
        const result = formatToolResult({
          content: [
            {type: 'text', text: 'header'},
            {type: 'image', mimeType: 'image/png', data: 'xyz'},
            {type: 'resource', resource: {uri: 'file:///foo.ts'}},
          ],
        })
        expect(result.content).toBe('header\n![image](data:image/png;base64,xyz)\n[resource: file:///foo.ts]')
      })

      it('drops unknown content part types and keeps known ones', () => {
        const result = formatToolResult({
          content: [
            {type: 'unknown-type', data: 'whatever'},
            {type: 'text', text: 'kept'},
          ],
        })
        expect(result.content).toBe('kept')
      })

      it('returns empty content when all parts have unknown types', () => {
        expect(formatToolResult({content: [{type: 'unknown-type', data: 'x'}]}).content).toBe('')
      })
    })

    describe('isError flag', () => {
      it('propagates isError true from the tool result', () => {
        expect(formatToolResult({content: [{type: 'text', text: 'err'}], isError: true}).isError).toBe(true)
      })

      it('normalises absent isError to false', () => {
        expect(formatToolResult({content: [{type: 'text', text: 'ok'}]}).isError).toBe(false)
      })
    })
  })
})
