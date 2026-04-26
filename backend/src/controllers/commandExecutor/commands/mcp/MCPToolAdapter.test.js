import {MCPToolAdapter} from './MCPToolAdapter'
import {MCP_DEFAULT_TIMEOUT_MS} from '../../constants/mcp'

const makeClient = (toolResult = {content: [{type: 'text', text: 'ok'}], isError: false}) => ({
  callTool: jest.fn().mockResolvedValue(toolResult),
})

const makeDescriptor = (overrides = {}) => ({
  name: 'my_tool',
  description: 'does something',
  inputSchema: {type: 'object', properties: {prompt: {type: 'string'}}, required: ['prompt']},
  ...overrides,
})

describe('MCPToolAdapter', () => {
  describe('construction', () => {
    it.each([
      ['uses name from toolDescriptor', 'name', 'my_tool', {}],
      ['uses description from toolDescriptor', 'description', 'does something', {}],
      ['falls back to name when description is absent', 'description', 'my_tool', {description: undefined}],
      ['falls back to name when description is empty string', 'description', 'my_tool', {description: ''}],
    ])('%s', (_label, prop, expected, overrides) => {
      const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor(overrides), client: makeClient()})
      expect(adapter[prop]).toBe(expected)
    })
  })

  describe('structured arguments from LangChain agent', () => {
    describe('single-property schema', () => {
      it.each([
        ['prompt property', {properties: {prompt: {type: 'string'}}}, {prompt: 'hello world'}],
        ['query property', {properties: {query: {type: 'string'}}}, {query: 'search term'}],
        ['input property', {properties: {input: {type: 'string'}}}, {input: 'do stuff'}],
      ])('%s', async (_label, inputSchema, input) => {
        const client = makeClient()
        const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor({inputSchema}), client})

        await adapter.call(input)

        expect(client.callTool).toHaveBeenCalledWith({name: 'my_tool', arguments: input}, undefined, expect.any(Object))
      })
    })

    describe('multi-property schema', () => {
      const multiSchema = {
        properties: {
          query: {type: 'string'},
          maxResults: {type: 'number'},
        },
      }

      it('receives structured object from LangChain agent', async () => {
        const client = makeClient()
        const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor({inputSchema: multiSchema}), client})

        await adapter.call({query: 'cats', maxResults: 5})

        expect(client.callTool).toHaveBeenCalledWith(
          {name: 'my_tool', arguments: {query: 'cats', maxResults: 5}},
          undefined,
          expect.any(Object),
        )
      })

      it('handles partial objects with optional fields', async () => {
        const client = makeClient()
        const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor({inputSchema: multiSchema}), client})

        await adapter.call({query: 'dogs'})

        expect(client.callTool).toHaveBeenCalledWith(
          {name: 'my_tool', arguments: {query: 'dogs'}},
          undefined,
          expect.any(Object),
        )
      })
    })

    describe('no-property or absent schema', () => {
      it.each([
        ['schema with no properties field', {type: 'object'}],
        ['schema with empty properties', {type: 'object', properties: {}}],
        ['null schema', null],
        ['undefined schema', undefined],
      ])('%s', async (_label, inputSchema) => {
        const client = makeClient()
        const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor({inputSchema}), client})

        await adapter.call({})

        expect(client.callTool).toHaveBeenCalledWith({name: 'my_tool', arguments: {}}, undefined, expect.any(Object))
      })
    })
  })

  describe('timeout', () => {
    it('uses MCP_DEFAULT_TIMEOUT_MS when timeoutMs is not specified', async () => {
      const client = makeClient()
      const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor(), client})

      await adapter.call({prompt: 'hi'})

      expect(client.callTool).toHaveBeenCalledWith(expect.any(Object), undefined, {timeout: MCP_DEFAULT_TIMEOUT_MS})
    })

    it.each([
      ['minimum boundary', 5_000],
      ['coding agent duration', 1_800_000],
      ['maximum boundary', 3_600_000],
    ])('passes custom timeoutMs to the client — %s ms', async (_label, timeoutMs) => {
      const client = makeClient()
      const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor(), client, timeoutMs})

      await adapter.call({prompt: 'hi'})

      expect(client.callTool).toHaveBeenCalledWith(expect.any(Object), undefined, {timeout: timeoutMs})
    })
  })

  describe('result handling', () => {
    it('returns the string content produced by formatToolResult', async () => {
      const client = makeClient({content: [{type: 'text', text: 'the answer'}], isError: false})
      const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor(), client})

      expect(await adapter.call({prompt: 'q'})).toBe('the answer')
    })

    it('returns empty string when the tool result has no content', async () => {
      const client = makeClient({content: [], isError: false})
      const adapter = new MCPToolAdapter({toolDescriptor: makeDescriptor(), client})

      expect(await adapter.call({prompt: 'q'})).toBe('')
    })
  })
})
