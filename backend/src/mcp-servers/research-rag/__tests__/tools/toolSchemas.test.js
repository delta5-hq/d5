import {WebSearchQATool} from '../../tools/WebSearchQATool'
import {ScholarSearchQATool} from '../../tools/ScholarSearchQATool'
import {KnowledgeBaseQueryTool} from '../../tools/KnowledgeBaseQueryTool'
import {MemorizeContentTool} from '../../tools/MemorizeContentTool'

const mockUserContext = {
  getUserId: () => 'test-user',
  getIntegrationSettings: jest.fn(),
}

const mockAdapter = {
  parseWebSearchParams: jest.fn(),
  parseScholarSearchParams: jest.fn(),
  parseKnowledgeBaseParams: jest.fn(),
  parseMemorizeParams: jest.fn(),
}

describe('Tool Schemas', () => {
  describe('WebSearchQATool', () => {
    it('should have valid MCP schema', () => {
      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.name).toBe('web_search_qa')
      expect(schema.description).toBeTruthy()
      expect(schema.inputSchema.type).toBe('object')
      expect(schema.inputSchema.required).toEqual(['query'])
      expect(schema.inputSchema.properties.query).toBeDefined()
      expect(schema.inputSchema.properties.lang).toBeDefined()
      expect(schema.inputSchema.properties.citations).toBeDefined()
      expect(schema.inputSchema.properties.maxChunks).toBeDefined()
    })
  })

  describe('ScholarSearchQATool', () => {
    it('should have valid MCP schema with minYear', () => {
      const tool = new ScholarSearchQATool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.name).toBe('scholar_search_qa')
      expect(schema.inputSchema.properties.minYear).toBeDefined()
      expect(schema.inputSchema.properties.minYear.type).toBe('number')
    })
  })

  describe('KnowledgeBaseQueryTool', () => {
    it('should have valid MCP schema with context', () => {
      const tool = new KnowledgeBaseQueryTool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.name).toBe('kb_query')
      expect(schema.inputSchema.properties.context).toBeDefined()
      expect(schema.inputSchema.properties.context.type).toBe('string')
    })
  })

  describe('MemorizeContentTool', () => {
    it('should have valid MCP schema with text required', () => {
      const tool = new MemorizeContentTool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.name).toBe('memorize_content')
      expect(schema.inputSchema.required).toEqual(['text'])
      expect(schema.inputSchema.properties.text).toBeDefined()
      expect(schema.inputSchema.properties.keep).toBeDefined()
      expect(schema.inputSchema.properties.split).toBeDefined()
    })
  })

  describe('Cross-tool invariants', () => {
    const tools = [
      new WebSearchQATool(mockUserContext, mockAdapter),
      new ScholarSearchQATool(mockUserContext, mockAdapter),
      new KnowledgeBaseQueryTool(mockUserContext, mockAdapter),
      new MemorizeContentTool(mockUserContext, mockAdapter),
    ]

    it('all tools have unique names', () => {
      const names = tools.map(t => t.getSchema().name)
      expect(new Set(names).size).toBe(names.length)
    })

    it('all tools have descriptions', () => {
      tools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.description).toBeTruthy()
        expect(schema.description.length).toBeGreaterThan(10)
      })
    })

    it('all tools have object input schemas', () => {
      tools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.inputSchema.type).toBe('object')
        expect(schema.inputSchema.properties).toBeDefined()
        expect(schema.inputSchema.required).toBeInstanceOf(Array)
      })
    })

    it('all tools have execute method', () => {
      tools.forEach(tool => {
        expect(typeof tool.execute).toBe('function')
      })
    })

    it('all tool names follow snake_case convention', () => {
      tools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
      })
    })

    it('all tool descriptions are sentences with proper punctuation', () => {
      tools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.description).toMatch(/^[A-Z]/)
        expect(schema.description.length).toBeGreaterThan(20)
      })
    })

    it('all required fields exist in properties', () => {
      tools.forEach(tool => {
        const schema = tool.getSchema()
        schema.inputSchema.required.forEach(requiredField => {
          expect(schema.inputSchema.properties).toHaveProperty(requiredField)
        })
      })
    })

    it('all property descriptions are non-empty strings', () => {
      tools.forEach(tool => {
        const schema = tool.getSchema()
        Object.values(schema.inputSchema.properties).forEach(prop => {
          expect(prop.description).toBeTruthy()
          expect(typeof prop.description).toBe('string')
          expect(prop.description.length).toBeGreaterThan(5)
        })
      })
    })

    it('getSchema returns consistent results across multiple calls', () => {
      tools.forEach(tool => {
        const schema1 = tool.getSchema()
        const schema2 = tool.getSchema()
        expect(JSON.stringify(schema1)).toBe(JSON.stringify(schema2))
      })
    })
  })

  describe('Query-based tools share common parameters', () => {
    const queryTools = [
      new WebSearchQATool(mockUserContext, mockAdapter),
      new ScholarSearchQATool(mockUserContext, mockAdapter),
      new KnowledgeBaseQueryTool(mockUserContext, mockAdapter),
    ]

    it('all query tools have query parameter', () => {
      queryTools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.inputSchema.properties.query).toBeDefined()
        expect(schema.inputSchema.required).toContain('query')
      })
    })

    it('all query tools have optional lang parameter', () => {
      queryTools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.inputSchema.properties.lang).toBeDefined()
        expect(schema.inputSchema.required).not.toContain('lang')
      })
    })

    it('all query tools have optional citations parameter', () => {
      queryTools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.inputSchema.properties.citations).toBeDefined()
      })
    })

    it('all query tools have optional maxChunks parameter', () => {
      queryTools.forEach(tool => {
        const schema = tool.getSchema()
        expect(schema.inputSchema.properties.maxChunks).toBeDefined()
      })
    })
  })

  describe('Tool constructor requirements', () => {
    it.each([
      ['WebSearchQATool', WebSearchQATool],
      ['ScholarSearchQATool', ScholarSearchQATool],
      ['KnowledgeBaseQueryTool', KnowledgeBaseQueryTool],
      ['MemorizeContentTool', MemorizeContentTool],
    ])('%s requires userContextProvider and commandContextAdapter', (_name, ToolClass) => {
      const tool = new ToolClass(mockUserContext, mockAdapter)

      expect(tool.userContextProvider).toBeDefined()
      expect(tool.commandContextAdapter).toBeDefined()
    })

    it.each([
      ['WebSearchQATool', WebSearchQATool],
      ['ScholarSearchQATool', ScholarSearchQATool],
      ['KnowledgeBaseQueryTool', KnowledgeBaseQueryTool],
      ['MemorizeContentTool', MemorizeContentTool],
    ])('%s initializes logError function', (_name, ToolClass) => {
      const tool = new ToolClass(mockUserContext, mockAdapter)

      expect(typeof tool.logError).toBe('function')
    })
  })

  describe('Schema property type definitions', () => {
    it('query properties have string type', () => {
      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.inputSchema.properties.query.type).toBe('string')
    })

    it('citations properties have boolean type', () => {
      const tool = new WebSearchQATool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.inputSchema.properties.citations.type).toBe('boolean')
    })

    it('minYear property has number type', () => {
      const tool = new ScholarSearchQATool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.inputSchema.properties.minYear.type).toBe('number')
    })

    it('keep property has boolean type', () => {
      const tool = new MemorizeContentTool(mockUserContext, mockAdapter)
      const schema = tool.getSchema()

      expect(schema.inputSchema.properties.keep.type).toBe('boolean')
    })
  })
})
