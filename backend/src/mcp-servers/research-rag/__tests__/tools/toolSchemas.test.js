import {z} from 'zod'
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

const allTools = [
  ['WebSearchQATool', WebSearchQATool, 'web_search_qa'],
  ['ScholarSearchQATool', ScholarSearchQATool, 'scholar_search_qa'],
  ['KnowledgeBaseQueryTool', KnowledgeBaseQueryTool, 'kb_query'],
  ['MemorizeContentTool', MemorizeContentTool, 'memorize_content'],
]

describe('Tool Zod API', () => {
  it.each(allTools)('%s.getName() returns expected snake_case name', (_label, ToolClass, expectedName) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    expect(tool.getName()).toBe(expectedName)
    expect(tool.getName()).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/)
  })

  it.each(allTools)('%s.getDescription() returns a non-empty sentence', (_label, ToolClass) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    const desc = tool.getDescription()
    expect(typeof desc).toBe('string')
    expect(desc.length).toBeGreaterThan(20)
    expect(desc).toMatch(/^[A-Z]/)
  })

  it.each(allTools)('%s.getZodShape() returns an object with ZodType values', (_label, ToolClass) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    const shape = tool.getZodShape()

    expect(typeof shape).toBe('object')
    expect(shape).not.toBeNull()
    Object.values(shape).forEach(value => {
      expect(typeof value.safeParse).toBe('function')
      expect(typeof value.parse).toBe('function')
    })
  })

  it('all tool names are unique', () => {
    const names = allTools.map(([, ToolClass]) => new ToolClass(mockUserContext, mockAdapter).getName())
    expect(new Set(names).size).toBe(names.length)
  })

  it('all tools expose execute method', () => {
    allTools.forEach(([, ToolClass]) => {
      const tool = new ToolClass(mockUserContext, mockAdapter)
      expect(typeof tool.execute).toBe('function')
    })
  })

  it.each(allTools)('%s.getZodShape() returns consistent field set across multiple calls', (_label, ToolClass) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    const shape1 = tool.getZodShape()
    const shape2 = tool.getZodShape()
    expect(Object.keys(shape1).sort()).toEqual(Object.keys(shape2).sort())
  })
})

describe('Tool Zod shape semantics', () => {
  const queryTools = [
    ['WebSearchQATool', WebSearchQATool],
    ['ScholarSearchQATool', ScholarSearchQATool],
    ['KnowledgeBaseQueryTool', KnowledgeBaseQueryTool],
  ]

  it.each(queryTools)('%s requires query', (_label, ToolClass) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    const shape = tool.getZodShape()
    expect(shape.query).toBeDefined()
    const schema = z.object({query: shape.query})
    expect(schema.safeParse({}).success).toBe(false)
  })

  it.each(queryTools)('%s has optional lang/citations/maxChunks', (_label, ToolClass) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    const shape = tool.getZodShape()
    ;['lang', 'citations', 'maxChunks'].forEach(field => {
      expect(shape[field]).toBeDefined()
      const schema = z.object({[field]: shape[field]})
      expect(schema.safeParse({}).success).toBe(true)
    })
  })

  it('ScholarSearchQATool exposes minYear of Zod number type', () => {
    const tool = new ScholarSearchQATool(mockUserContext, mockAdapter)
    const shape = tool.getZodShape()
    expect(shape.minYear).toBeDefined()
    expect(shape.minYear.safeParse(2020).success).toBe(true)
    expect(shape.minYear.safeParse('2020').success).toBe(false)
  })

  it('KnowledgeBaseQueryTool exposes optional context', () => {
    const tool = new KnowledgeBaseQueryTool(mockUserContext, mockAdapter)
    const shape = tool.getZodShape()
    expect(shape.context).toBeDefined()
    expect(z.object({context: shape.context}).safeParse({}).success).toBe(true)
  })

  it('MemorizeContentTool requires text and exposes keep/split', () => {
    const tool = new MemorizeContentTool(mockUserContext, mockAdapter)
    const shape = tool.getZodShape()
    expect(z.object({text: shape.text}).safeParse({}).success).toBe(false)
    expect(shape.keep).toBeDefined()
    expect(shape.split).toBeDefined()
  })
})

describe('Tool constructor requirements', () => {
  it.each(allTools)('%s requires userContextProvider and commandContextAdapter', (_label, ToolClass) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    expect(tool.userContextProvider).toBeDefined()
    expect(tool.commandContextAdapter).toBeDefined()
  })

  it.each(allTools)('%s initializes logError function', (_label, ToolClass) => {
    const tool = new ToolClass(mockUserContext, mockAdapter)
    expect(typeof tool.logError).toBe('function')
  })
})
