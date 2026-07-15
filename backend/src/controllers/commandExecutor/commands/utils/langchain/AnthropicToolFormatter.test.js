import {formatToolsForAnthropic, extractToolCallsFromContent} from './AnthropicToolFormatter'

const mcpTool = (name, description, inputSchema) => ({name, description, inputSchema})
const minimalTool = (name, description) => ({name, description})

describe('formatToolsForAnthropic', () => {
  describe('input_schema resolution', () => {
    describe('uses inputSchema directly when present and is an object', () => {
      it('passes the object reference through unchanged', () => {
        const inputSchema = {type: 'object', properties: {url: {type: 'string'}}, required: ['url']}
        const [result] = formatToolsForAnthropic([mcpTool('fetch', 'Fetch a URL', inputSchema)])
        expect(result.input_schema).toBe(inputSchema)
      })

      it.each([
        ['empty properties', {type: 'object', properties: {}}],
        ['nested properties', {type: 'object', properties: {a: {type: 'object', properties: {b: {type: 'string'}}}}}],
        ['required fields', {type: 'object', properties: {x: {type: 'number'}}, required: ['x']}],
      ])('accepts %s as inputSchema', (_label, inputSchema) => {
        const [result] = formatToolsForAnthropic([mcpTool('t', 'd', inputSchema)])
        expect(result.input_schema).toBe(inputSchema)
      })
    })

    describe('falls through to convertToOpenAIFunction when inputSchema is absent or non-object', () => {
      it('returns empty-property schema when tool has no schema at all', () => {
        const [result] = formatToolsForAnthropic([minimalTool('ping', 'No params')])
        expect(result.input_schema).toMatchObject({type: 'object', properties: {}})
      })

      it.each([null, undefined, false, 0, '', 'object'])(
        'treats inputSchema=%p as absent and falls through',
        inputSchema => {
          const tool = {...minimalTool('t', 'd'), inputSchema}
          const [result] = formatToolsForAnthropic([tool])
          expect(result.input_schema).toBeDefined()
          expect(typeof result.input_schema).toBe('object')
          expect(result.input_schema).not.toBeNull()
        },
      )
    })
  })

  describe('output shape', () => {
    it('result contains exactly name, description, and input_schema — no extra fields', () => {
      const inputSchema = {type: 'object', properties: {}}
      const [result] = formatToolsForAnthropic([mcpTool('t', 'd', inputSchema)])
      expect(Object.keys(result).sort()).toEqual(['description', 'input_schema', 'name'])
    })

    it('strips inputSchema and schema from output', () => {
      const [result] = formatToolsForAnthropic([mcpTool('t', 'd', {type: 'object', properties: {}})])
      expect(result).not.toHaveProperty('inputSchema')
      expect(result).not.toHaveProperty('schema')
    })

    it('preserves name and description verbatim', () => {
      const [result] = formatToolsForAnthropic([
        mcpTool('my_tool_01', 'Exact description text', {type: 'object', properties: {}}),
      ])
      expect(result.name).toBe('my_tool_01')
      expect(result.description).toBe('Exact description text')
    })
  })

  describe('array handling', () => {
    it('returns empty array for empty input', () => {
      expect(formatToolsForAnthropic([])).toEqual([])
    })

    it('maps every tool preserving order', () => {
      const tools = [
        mcpTool('tool_a', 'A', {type: 'object', properties: {a: {type: 'string'}}}),
        mcpTool('tool_b', 'B', {type: 'object', properties: {b: {type: 'number'}}}),
        mcpTool('tool_c', 'C', {type: 'object', properties: {}}),
      ]
      const result = formatToolsForAnthropic(tools)
      expect(result).toHaveLength(3)
      expect(result.map(t => t.name)).toEqual(['tool_a', 'tool_b', 'tool_c'])
    })
  })
})

describe('extractToolCallsFromContent', () => {
  describe('tool_use block extraction', () => {
    it('maps id, name, and input to args', () => {
      const content = [{type: 'tool_use', id: 'toolu_01', name: 'search', input: {query: 'weather'}}]
      const [call] = extractToolCallsFromContent(content)
      expect(call).toEqual({id: 'toolu_01', name: 'search', args: {query: 'weather'}})
    })

    it('renames input to args — result has no input property', () => {
      const [call] = extractToolCallsFromContent([{type: 'tool_use', id: 'id1', name: 'fn', input: {x: 1}}])
      expect(call.args).toEqual({x: 1})
      expect(call).not.toHaveProperty('input')
    })

    it('preserves empty args object', () => {
      const [call] = extractToolCallsFromContent([{type: 'tool_use', id: 'id1', name: 'fn', input: {}}])
      expect(call.args).toEqual({})
    })

    it('extracts multiple tool_use blocks in order', () => {
      const content = [
        {type: 'tool_use', id: 'toolu_01', name: 'search', input: {query: 'weather'}},
        {type: 'tool_use', id: 'toolu_02', name: 'fetch', input: {url: 'https://example.com'}},
      ]
      const result = extractToolCallsFromContent(content)
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({id: 'toolu_01', name: 'search'})
      expect(result[1]).toMatchObject({id: 'toolu_02', name: 'fetch'})
    })
  })

  describe('non-tool_use block filtering', () => {
    it('returns empty array when content has no tool_use blocks', () => {
      expect(extractToolCallsFromContent([{type: 'text', text: 'Just text'}])).toEqual([])
    })

    it('returns empty array for empty content', () => {
      expect(extractToolCallsFromContent([])).toEqual([])
    })

    it.each(['text', 'thinking', 'image', 'unknown'])('filters out %s blocks', blockType => {
      const content = [
        {type: blockType, text: 'ignored'},
        {type: 'tool_use', id: 'id1', name: 'fn', input: {x: 1}},
      ]
      const result = extractToolCallsFromContent(content)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('fn')
    })

    it('returns only tool calls when mixed content contains text, thinking, and tool_use', () => {
      const content = [
        {type: 'thinking', thinking: 'Let me reason...'},
        {type: 'text', text: 'I will search for this.'},
        {type: 'tool_use', id: 'toolu_01', name: 'search', input: {q: 'test'}},
        {type: 'text', text: 'Done.'},
      ]
      const result = extractToolCallsFromContent(content)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('toolu_01')
    })
  })
})
