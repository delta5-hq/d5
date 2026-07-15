import {dispatchMemorize} from './MemorizeDispatcher'
import Store from '../utils/Store'
import {DEFAULT_CONTEXT_NAME} from '../../constants/ext'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const mockRunDirectMode = jest.fn()

jest.mock('../MCPCommand', () => ({
  MCPCommand: jest.fn().mockImplementation(() => ({
    runDirectMode: mockRunDirectMode,
  })),
}))

jest.mock('../mcp/internalServerEnv', () => ({
  buildInternalServerEnv: jest.fn().mockReturnValue({ENV_VAR: 'value'}),
  resolveInternalServerScript: jest.fn().mockReturnValue('/path/to/server.js'),
}))

jest.mock('../utils/langchain/getLLM', () => ({
  getIntegrationSettings: jest.fn().mockResolvedValue({}),
}))

jest.mock('../utils/NodeTextExtractor', () => ({
  NodeTextExtractor: jest.fn().mockImplementation(() => ({
    extractFullContent: jest.fn().mockResolvedValue('Extracted text content'),
  })),
}))

const buildStore = nodes => new Store({userId: 'user-1', workflowId: 'wf-1', nodes})

const makeMemorizeCell = (command, parentId = 'parentNode') => ({
  id: 'memorizeNode',
  command,
  title: command,
  parent: parentId,
})

const makeParent = (extra = {}) => ({
  id: 'parentNode',
  title: 'Parent text',
  children: ['memorizeNode'],
  ...extra,
})

describe('MemorizeDispatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRunDirectMode.mockResolvedValue({content: 'Memorized 1 chunk', isError: false})
  })

  describe('error conditions', () => {
    it('creates an error node when the memorize cell has no parent', async () => {
      const cell = {...makeMemorizeCell('/memorize'), parent: undefined}
      const store = buildStore({memorizeNode: cell})
      const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

      await dispatchMemorize(cell, store, undefined)

      expect(createErrorNodeSpy).toHaveBeenCalledWith(expect.stringContaining('requires a parent node'), cell.id)
    })

    it('creates an error node when the parent node does not exist in the store', async () => {
      const cell = makeMemorizeCell('/memorize', 'missingParent')
      const store = buildStore({memorizeNode: cell})
      const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

      await dispatchMemorize(cell, store, undefined)

      expect(createErrorNodeSpy).toHaveBeenCalledWith(expect.stringContaining('requires a parent node'), cell.id)
    })

    it('creates an error node when extracted content is empty', async () => {
      const {NodeTextExtractor} = require('../utils/NodeTextExtractor')
      NodeTextExtractor.mockImplementationOnce(() => ({
        extractFullContent: jest.fn().mockResolvedValue('   '),
      }))

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})
      const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

      await dispatchMemorize(cell, store, undefined)

      expect(createErrorNodeSpy).toHaveBeenCalledWith(expect.stringContaining('No content to memorize'), cell.id)
    })

    it('creates an error node when extracted content is null', async () => {
      const {NodeTextExtractor} = require('../utils/NodeTextExtractor')
      NodeTextExtractor.mockImplementationOnce(() => ({
        extractFullContent: jest.fn().mockResolvedValue(null),
      }))

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})
      const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

      await dispatchMemorize(cell, store, undefined)

      expect(createErrorNodeSpy).toHaveBeenCalledWith(expect.stringContaining('No content to memorize'), cell.id)
    })

    it('creates an error node when MCP tool returns isError=true', async () => {
      mockRunDirectMode.mockResolvedValueOnce({content: 'Tool failed', isError: true})

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})
      const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

      await dispatchMemorize(cell, store, undefined)

      expect(createErrorNodeSpy).toHaveBeenCalledWith(expect.stringContaining('Tool failed'), cell.id)
    })

    it('creates an error node with fallback message when MCP error content is empty', async () => {
      mockRunDirectMode.mockResolvedValueOnce({content: '', isError: true})

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})
      const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

      await dispatchMemorize(cell, store, undefined)

      expect(createErrorNodeSpy).toHaveBeenCalledWith(expect.stringContaining('MCP tool returned an error'), cell.id)
    })

    it('creates an error node when MCP tool rejects', async () => {
      mockRunDirectMode.mockRejectedValueOnce(new Error('Connection refused'))

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})
      const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

      await dispatchMemorize(cell, store, undefined)

      expect(createErrorNodeSpy).toHaveBeenCalledWith(expect.stringContaining('Connection refused'), cell.id)
    })

    it('never throws — always resolves', async () => {
      mockRunDirectMode.mockRejectedValueOnce(new Error('Unrecoverable'))
      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await expect(dispatchMemorize(cell, store, undefined)).resolves.not.toThrow()
    })
  })

  describe('successful dispatch', () => {
    it('calls runDirectMode with extracted text as prompt', async () => {
      const {NodeTextExtractor} = require('../utils/NodeTextExtractor')
      NodeTextExtractor.mockImplementationOnce(() => ({
        extractFullContent: jest.fn().mockResolvedValue('My extracted content'),
      }))

      const cell = makeMemorizeCell('/memorize --context=notes')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(mockRunDirectMode).toHaveBeenCalledWith(
        'My extracted content',
        undefined,
        expect.any(Object),
        expect.any(Array),
      )
    })

    it('creates output nodes from MCP tool response', async () => {
      mockRunDirectMode.mockResolvedValueOnce({content: 'Stored 3 chunks', isError: false})

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await dispatchMemorize(cell, store, undefined)

      expect(createNodesSpy).toHaveBeenCalledWith('Stored 3 chunks', cell.id)
    })

    it('uses fallback label when MCP response content is empty string', async () => {
      mockRunDirectMode.mockResolvedValueOnce({content: '', isError: false})

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await dispatchMemorize(cell, store, undefined)

      expect(createNodesSpy).toHaveBeenCalledWith('(empty MCP response)', cell.id)
    })

    it('passes signal through to runDirectMode', async () => {
      const signal = {aborted: false}
      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, signal)

      expect(mockRunDirectMode).toHaveBeenCalledWith(expect.any(String), signal, expect.any(Object), expect.any(Array))
    })
  })

  describe('parameter parsing', () => {
    const getStaticArgs = () => require('../MCPCommand').MCPCommand.mock.calls.at(-1)?.[3]?.toolStaticArgs

    const dispatchCommand = async command => {
      const {MCPCommand} = require('../MCPCommand')
      MCPCommand.mockClear()

      const cell = makeMemorizeCell(command)
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      return getStaticArgs()
    }

    it.each([
      ['default context', '/memorize', DEFAULT_CONTEXT_NAME],
      ['single-token context', '/memorize --context=mybook', 'mybook'],
      ['hyphenated context', '/memorize --context=project-notes', 'project-notes'],
    ])('reads %s', async (_label, command, expectedContext) => {
      await expect(dispatchCommand(command)).resolves.toMatchObject({context: expectedContext})
    })

    it('sets keep=true when context is DEFAULT_CONTEXT_NAME and no explicit --keep', async () => {
      const {MCPCommand} = require('../MCPCommand')
      MCPCommand.mockClear()

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getStaticArgs().keep).toBe(true)
    })

    it('sets keep=false when context is not default and no explicit --keep', async () => {
      const {MCPCommand} = require('../MCPCommand')
      MCPCommand.mockClear()

      const cell = makeMemorizeCell('/memorize --context=customctx')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getStaticArgs().keep).toBe(false)
    })

    it('respects explicit --keep=true override on non-default context', async () => {
      const {MCPCommand} = require('../MCPCommand')
      MCPCommand.mockClear()

      const cell = makeMemorizeCell('/memorize --context=customctx --keep=true')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getStaticArgs().keep).toBe(true)
    })

    it('respects explicit --keep=false override on default context', async () => {
      const {MCPCommand} = require('../MCPCommand')
      MCPCommand.mockClear()

      const cell = makeMemorizeCell('/memorize --keep=false')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getStaticArgs().keep).toBe(false)
    })

    it('omits split from toolStaticArgs when --split not given', async () => {
      const {MCPCommand} = require('../MCPCommand')
      MCPCommand.mockClear()

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getStaticArgs()).not.toHaveProperty('split')
    })

    it('includes split in toolStaticArgs when --split param given', async () => {
      const {MCPCommand} = require('../MCPCommand')
      MCPCommand.mockClear()

      const cell = makeMemorizeCell('/memorize --split="\\n\\n"')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getStaticArgs()).toHaveProperty('split')
    })
  })

  describe('text size resolution', () => {
    const getExtractorMaxSize = () => {
      const {NodeTextExtractor} = require('../utils/NodeTextExtractor')
      const constructorCall = NodeTextExtractor.mock.calls.at(-1)
      return constructorCall?.[0]
    }

    // Size flags use --xxl / --xl / --l / --s / --xs / --xxs (not --maxChunks=)
    // because readMaxChunksParam matches CHUNK_SIZE_REGEX which looks for flag names directly.
    it.each([
      ['--xxl', Infinity],
      ['--xl', 20000],
      ['--l', 10000],
      ['--s', 2000],
      ['--xs', 1000],
      ['--xxs', 500],
    ])('maps size flag %s to textSize %i', async (flag, expectedSize) => {
      const {NodeTextExtractor} = require('../utils/NodeTextExtractor')
      NodeTextExtractor.mockClear()

      const cell = makeMemorizeCell(`/memorize ${flag}`)
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getExtractorMaxSize()).toBe(expectedSize)
    })

    it('defaults to xs (1000) when no size flag is given', async () => {
      const {NodeTextExtractor} = require('../utils/NodeTextExtractor')
      NodeTextExtractor.mockClear()

      const cell = makeMemorizeCell('/memorize')
      const parent = makeParent()
      const store = buildStore({memorizeNode: cell, parentNode: parent})

      await dispatchMemorize(cell, store, undefined)

      expect(getExtractorMaxSize()).toBe(1000)
    })
  })
})
