import {dispatchOutlineSummarize} from './OutlineSummarizeDispatcher'
import Store from '../utils/Store'
import {SummarizeCommand} from '../SummarizeCommand'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../references/substitution', () => ({
  substituteReferencesAndHashrefsChildrenAndSelf: jest.fn().mockReturnValue('resolved prompt'),
}))

const buildStore = nodes => new Store({userId: 'user-1', workflowId: 'wf-1', nodes})

const makeCell = (command = '/outline --summarize query') => ({
  id: 'outlineNode',
  command,
  title: command,
  parent: 'rootNode',
  children: [],
})

describe('OutlineSummarizeDispatcher', () => {
  let replyDefaultSpy

  beforeEach(() => {
    replyDefaultSpy = jest
      .spyOn(SummarizeCommand.prototype, 'replyDefault')
      .mockResolvedValue('["Topic A","Topic B","Topic C"]')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('successful dispatch', () => {
    it('calls SummarizeCommand.replyDefault with the cell and node command', async () => {
      const cell = makeCell('/outline --summarize my topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(replyDefaultSpy).toHaveBeenCalledWith(
        cell,
        expect.any(String),
        'resolved prompt',
        expect.objectContaining({structured: true}),
      )
    })

    it('creates nodes from tree when LLM response is parseable as a list', async () => {
      replyDefaultSpy.mockResolvedValueOnce('["Branch A","Branch B"]')

      const cell = makeCell('/outline --summarize research topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(createNodesSpy).toHaveBeenCalledWith(expect.anything(), cell.id)
    })

    it('falls back to raw text when LLM response cannot be parsed as a tree', async () => {
      replyDefaultSpy.mockResolvedValueOnce('Plain text answer that is not an array')

      const cell = makeCell('/outline --summarize topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(createNodesSpy).toHaveBeenCalledWith('Plain text answer that is not an array', cell.id)
    })

    it('falls back to raw text when JSON is valid but not an array of strings', async () => {
      replyDefaultSpy.mockResolvedValueOnce('{"key": "value"}')

      const cell = makeCell('/outline --summarize topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(createNodesSpy).toHaveBeenCalledWith('{"key": "value"}', cell.id)
    })

    it('passes signal through to SummarizeCommand.replyDefault', async () => {
      const signal = {aborted: false}
      const cell = makeCell('/outline --summarize topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})

      await dispatchOutlineSummarize(cell, store, signal)

      expect(replyDefaultSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({signal}),
      )
    })

    it('passes structured=true to SummarizeCommand.replyDefault', async () => {
      const cell = makeCell('/outline --summarize topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(replyDefaultSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({structured: true}),
      )
    })
  })

  describe('error conditions', () => {
    it('creates an error node when SummarizeCommand.replyDefault throws', async () => {
      replyDefaultSpy.mockRejectedValueOnce(new Error('LLM unavailable'))

      const cell = makeCell('/outline --summarize topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(createNodesSpy).toHaveBeenCalledWith(expect.stringContaining('LLM unavailable'), cell.id)
    })

    it('never throws — always resolves even on complete failure', async () => {
      replyDefaultSpy.mockRejectedValueOnce(new Error('Fatal'))

      const cell = makeCell('/outline --summarize topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})

      await expect(dispatchOutlineSummarize(cell, store, undefined)).resolves.not.toThrow()
    })

    it('creates a node even when answer is empty string (passes through to createNodes)', async () => {
      replyDefaultSpy.mockResolvedValueOnce('')

      const cell = makeCell('/outline --summarize topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})
      const createNodesSpy = jest.spyOn(store.importer, 'createNodes')

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(createNodesSpy).toHaveBeenCalledWith(expect.anything(), cell.id)
    })
  })

  describe('size label extraction', () => {
    it('passes sizeLabel derived from --embed param when present', async () => {
      const {substituteReferencesAndHashrefsChildrenAndSelf} = require('../references/substitution')
      substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('/outline --summarize --embed=l topic')

      const cell = makeCell('/outline --summarize --embed=l topic')
      const store = buildStore({outlineNode: cell, rootNode: {id: 'rootNode', title: 'Root'}})

      await dispatchOutlineSummarize(cell, store, undefined)

      expect(replyDefaultSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        expect.objectContaining({sizeLabel: expect.anything()}),
      )
    })
  })
})
