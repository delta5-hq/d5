import {callTool, listTools} from './MCPClientManager'
import {createTransport} from './createTransport'
import {MCP_DEFAULT_TIMEOUT_MS} from '../../constants/mcp'

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

  describe('callTool', () => {
    describe('lifecycle', () => {
      it('connects, calls tool, and closes client in sequence', async () => {
        mockCallTool.mockResolvedValue({content: [{type: 'text', text: 'ok'}], isError: false})

        await callTool({...baseRequest, toolArguments: {prompt: 'test'}})

        expect(mockConnect).toHaveBeenCalledTimes(1)
        expect(mockCallTool).toHaveBeenCalledTimes(1)
        expect(mockClose).toHaveBeenCalledTimes(1)
      })

      it('closes client even when callTool rejects', async () => {
        mockCallTool.mockRejectedValue(new Error('tool failure'))

        await expect(callTool(baseRequest)).rejects.toThrow('tool failure')

        expect(mockClose).toHaveBeenCalledTimes(1)
      })

      it('closes client even when connect rejects', async () => {
        mockConnect.mockRejectedValue(new Error('connect failure'))

        await expect(callTool(baseRequest)).rejects.toThrow('connect failure')

        expect(mockClose).toHaveBeenCalledTimes(1)
      })

      it('swallows close failure silently', async () => {
        mockCallTool.mockResolvedValue({content: [{type: 'text', text: 'ok'}], isError: false})
        mockClose.mockRejectedValue(new Error('close failure'))

        const result = await callTool(baseRequest)

        expect(result.content).toBe('ok')
      })
    })

    describe('arguments', () => {
      it('uses default timeout when not specified', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool(baseRequest)

        expect(mockCallTool).toHaveBeenCalledWith(expect.any(Object), undefined, {timeout: MCP_DEFAULT_TIMEOUT_MS})
      })

      it('passes custom timeout when specified', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool({...baseRequest, timeoutMs: 5000})

        expect(mockCallTool).toHaveBeenCalledWith(expect.any(Object), undefined, {timeout: 5000})
      })

      it('defaults toolArguments to empty object when omitted', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool(baseRequest)

        expect(mockCallTool).toHaveBeenCalledWith({name: 'execute', arguments: {}}, undefined, expect.any(Object))
      })

      it('passes provided toolArguments through', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool({...baseRequest, toolArguments: {prompt: 'hello', mode: 'fast'}})

        expect(mockCallTool).toHaveBeenCalledWith(
          {name: 'execute', arguments: {prompt: 'hello', mode: 'fast'}},
          undefined,
          expect.any(Object),
        )
      })

      it('forwards headers to createTransport', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})
        const hdrs = {Authorization: 'Bearer tok'}

        await callTool({...baseRequest, headers: hdrs})

        expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({headers: hdrs}))
      })

      it('passes undefined headers when omitted', async () => {
        mockCallTool.mockResolvedValue({content: [], isError: false})

        await callTool(baseRequest)

        expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({headers: undefined}))
      })
    })

    describe('result formatting', () => {
      it('extracts text from single text content part', async () => {
        mockCallTool.mockResolvedValue({content: [{type: 'text', text: 'result'}], isError: false})

        expect(await callTool(baseRequest)).toEqual({isError: false, content: 'result'})
      })

      it('joins multiple text parts with newline', async () => {
        mockCallTool.mockResolvedValue({
          content: [
            {type: 'text', text: 'line 1'},
            {type: 'text', text: 'line 2'},
          ],
          isError: false,
        })

        expect((await callTool(baseRequest)).content).toBe('line 1\nline 2')
      })

      it('filters out non-text content parts', async () => {
        mockCallTool.mockResolvedValue({
          content: [
            {type: 'image', data: 'base64...'},
            {type: 'text', text: 'kept'},
            {type: 'resource', uri: 'file://x'},
          ],
          isError: false,
        })

        expect((await callTool(baseRequest)).content).toBe('kept')
      })

      it.each([
        ['all parts are non-text', [{type: 'image', data: 'base64...'}]],
        ['content array is empty', []],
      ])('returns empty content when %s', async (_label, content) => {
        mockCallTool.mockResolvedValue({content, isError: false})

        expect((await callTool(baseRequest)).content).toBe('')
      })

      it.each([
        ['no content property', {isError: false}],
        ['null result', null],
      ])('returns empty content for %s', async (_label, result) => {
        mockCallTool.mockResolvedValue(result)

        expect((await callTool(baseRequest)).content).toBe('')
      })

      it('propagates isError flag from tool result', async () => {
        mockCallTool.mockResolvedValue({
          content: [{type: 'text', text: 'error detail'}],
          isError: true,
        })

        const result = await callTool(baseRequest)

        expect(result.isError).toBe(true)
        expect(result.content).toBe('error detail')
      })

      it('defaults isError to false when absent', async () => {
        mockCallTool.mockResolvedValue({content: [{type: 'text', text: 'ok'}]})

        expect((await callTool(baseRequest)).isError).toBe(false)
      })

      it('preserves empty-string text parts in join', async () => {
        mockCallTool.mockResolvedValue({
          content: [
            {type: 'text', text: 'first'},
            {type: 'text', text: ''},
            {type: 'text', text: 'third'},
          ],
          isError: false,
        })

        expect((await callTool(baseRequest)).content).toBe('first\n\nthird')
      })
    })
  })

  describe('listTools', () => {
    it('returns tool descriptors from server', async () => {
      const tools = [
        {name: 'toolA', description: 'A', inputSchema: {}},
        {name: 'toolB', description: 'B', inputSchema: {type: 'object'}},
      ]
      mockListTools.mockResolvedValue({tools})

      expect(await listTools({serverUrl: 'http://srv:3100', transport: 'streamable-http'})).toEqual(tools)
    })

    it('connects and closes client', async () => {
      mockListTools.mockResolvedValue({tools: []})

      await listTools({serverUrl: 'http://srv:3100', transport: 'streamable-http'})

      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('closes client when listTools rejects', async () => {
      mockListTools.mockRejectedValue(new Error('list failure'))

      await expect(listTools({serverUrl: 'http://srv:3100', transport: 'streamable-http'})).rejects.toThrow(
        'list failure',
      )

      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('returns empty array when server has no tools', async () => {
      mockListTools.mockResolvedValue({tools: []})

      expect(await listTools({serverUrl: 'http://srv:3100', transport: 'streamable-http'})).toEqual([])
    })

    it('forwards headers to createTransport', async () => {
      mockListTools.mockResolvedValue({tools: []})

      await listTools({serverUrl: 'http://srv:3100', transport: 'streamable-http', headers: {'X-Api-Key': 'k'}})

      expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({headers: {'X-Api-Key': 'k'}}))
    })
  })
})
