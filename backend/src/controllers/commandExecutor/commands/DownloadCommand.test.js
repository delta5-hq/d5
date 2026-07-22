import {scrapeFiles} from '../../utils/scrape'
import {DownloadCommand} from './DownloadCommand'
import WorkflowFile from '../../../models/WorkflowFile'

jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
}))

jest.mock('../constants/steps', () => ({
  clearStepsPrefix: jest.fn(str => `cleared ${str}`),
}))
jest.mock('../constants', () => {
  const originalModule = jest.requireActual('../constants')
  return {
    ...originalModule,
    refRegExp: {test: jest.fn()},
  }
})

import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {clearStepsPrefix} from '../constants/steps'
import {referencePatterns} from './references/utils/referencePatterns'
import Store from './utils/Store'

jest.mock('../../utils/scrape')
jest.mock('../../../shared/utils/generateId', () => ({
  generateNodeId: jest.fn(() => 'mocked-node-id'),
}))
jest.mock('../../../models/WorkflowFile', () => ({
  write: jest.fn(() => Promise.resolve({_id: 'mocked-file-id'})),
}))
jest.mock('./references/substitution')

describe('DownloadCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new DownloadCommand(userId, workflowId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore._nodes = {}
    mockStore._files = {}
    WorkflowFile.write.mockResolvedValue({_id: 'mocked-file-id'})
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt with https://example.com')
  })

  describe('extractUrls', () => {
    it('should extract valid http and https URLs', () => {
      const input = 'Visit https://example.com and http://test.com for info.'
      const result = command.extractUniqueUrls(input)
      expect(result).toEqual(['https://example.com', 'http://test.com'])
    })

    it('should return an empty array if no URLs are present', () => {
      const input = 'This is a plain text string with no URLs.'
      const result = command.extractUniqueUrls(input)
      expect(result).toEqual([])
    })

    it('should ignore invalid protocols', () => {
      const input = 'ftp://invalid.com and file://localhost/file.txt should not be matched.'
      const result = command.extractUniqueUrls(input)
      expect(result).toEqual([])
    })

    it('should extract multiple URLs in one string', () => {
      const input = 'Check out https://example.com, http://test.com, and https://another.com.'
      const result = command.extractUniqueUrls(input)
      expect(result).toEqual(['https://example.com', 'http://test.com', 'https://another.com'])
    })

    it('should handle trailing punctuation and whitespace', () => {
      const input = 'Visit https://example.com. Or check out http://test.com! '
      const result = command.extractUniqueUrls(input)
      expect(result).toEqual(['https://example.com', 'http://test.com'])
    })

    it('should skip duplications', () => {
      const input = 'Visit https://example.com. Or check out http://test.com/ http://test.com'
      const result = command.extractUniqueUrls(input)
      expect(result).toEqual(['https://example.com', 'http://test.com'])
    })

    it('should extract url from brackets', () => {
      const input =
        'Visit [Phraseologisms Used with the Term Dog](https://cyberleninka.ru/article/n/phraseologisms-used-with-the-term-dog.pdf).'
      const result = command.extractUniqueUrls(input)
      expect(result).toEqual(['https://cyberleninka.ru/article/n/phraseologisms-used-with-the-term-dog.pdf'])
    })
  })

  describe('insertFileToWorkflow', () => {
    it.each(['', 'plain text', 'ftp://example.com/file.txt'])('rejects input without http URLs: %j', async input => {
      await expect(command.insertFileToWorkflow({}, input, {})).rejects.toThrow('No valid URL found for /download')
    })

    it.each([
      ['empty array', []],
      ['null', null],
      ['undefined', undefined],
    ])('rejects when scraper returns %s', async (_, scrapeResult) => {
      scrapeFiles.mockResolvedValue(scrapeResult)

      await expect(command.insertFileToWorkflow({}, 'https://test.com', {})).rejects.toThrow(
        'No downloadable content returned for https://test.com',
      )
    })

    it('should insert new files and create nodes for existing files', async () => {
      scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'file content'}])

      await command.insertFileToWorkflow({id: 'parent'}, 'https://test.com')

      const createdNode = mockStore._nodes['mocked-node-id']

      expect(createdNode).toEqual({
        id: 'mocked-node-id',
        file: 'mocked-file-id',
        title: 'test.txt',
        parent: 'parent',
      })
    })

    it('rejects when file upload fails instead of logging a silent no-op', async () => {
      WorkflowFile.write.mockRejectedValue(new Error('gridfs unavailable'))
      scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'file content'}])

      await expect(command.insertFileToWorkflow({id: 'parent'}, 'https://test.com')).rejects.toThrow(
        'gridfs unavailable',
      )
    })

    it('rejects when downloaded content is already attached to the target node', async () => {
      mockStore._nodes = {
        parent: {id: 'parent', children: ['existing']},
        existing: {id: 'existing', parent: 'parent', file: 'file-1', title: 'test.txt'},
      }
      mockStore._files = {'file-1': 'file content'}
      scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'file content'}])

      await expect(command.insertFileToWorkflow({id: 'parent'}, 'https://test.com')).rejects.toThrow(
        'Downloaded content already exists on this node for https://test.com',
      )
    })

    it('creates a confirmation node when downloaded content already exists elsewhere in the workflow', async () => {
      mockStore._nodes = {
        parent: {id: 'parent', children: []},
        source: {id: 'source', parent: 'other-parent', file: 'file-1', title: 'test.txt'},
      }
      mockStore._files = {'file-1': 'file content'}
      scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'file content'}])
      const createNodesSpy = jest.spyOn(mockStore.importer, 'createNodes').mockImplementation(() => {})

      await command.insertFileToWorkflow({id: 'parent'}, 'https://test.com')

      expect(createNodesSpy).toHaveBeenCalledWith('Downloaded content already attached: test.txt', 'parent')
      createNodesSpy.mockRestore()
    })
  })

  describe('run', () => {
    let downloadAndInsertSpy
    let createNodesSpy

    beforeEach(() => {
      downloadAndInsertSpy = jest.spyOn(command, 'insertFileToWorkflow').mockResolvedValue([])
      createNodesSpy = jest.spyOn(mockStore.importer, 'createNodes').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should substitute references and get URL', async () => {
      const refNode = {id: 'ref', title: '@url https://example.com'}
      const node = {id: 'node', command: '/download @@url'}
      substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('https://example.com')

      downloadAndInsertSpy.mockResolvedValue([])

      await command.run(
        node,
        undefined,
        {
          [refNode.id]: refNode,
          [node.id]: node,
        },
        {},
      )
      expect(downloadAndInsertSpy.mock.calls[0][1]).toBe('https://example.com')
    })

    it('should read max_size and max_pages params', async () => {
      const node = {id: 'node', command: '/download https://example.com --max_size=4mb --max_pages=5'}

      downloadAndInsertSpy.mockResolvedValue([])
      await command.run(node, 'https://example.com')

      expect(downloadAndInsertSpy).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        max_pages: '5',
        max_size: '4mb',
      })
    })

    it('should read max_size and max_pages params and send to scrape api', async () => {
      const node = {id: 'node', command: '/download https://example.com --max_size=4mb --max_pages=5'}

      downloadAndInsertSpy.mockRestore()
      const scrapeSpy = jest.spyOn(command, 'scrape').mockResolvedValue([])
      await command.run(node, 'https://example.com')

      expect(scrapeSpy).toHaveBeenCalledWith(expect.anything(), {max_pages: '5', max_size: '4mb'})
      scrapeSpy.mockRestore()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)

      const node = {id: 'node', title: '/download @@reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
      expect(downloadAndInsertSpy.mock.calls[0][1]).toBe('substituted prompt with https://example.com')
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/download without reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)

      const node = {id: 'node', title: '/download without reference'}
      const originalPrompt = 'https://example.com'

      await command.run(node, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
      expect(downloadAndInsertSpy.mock.calls[0][1]).toBe('cleared https://example.com')
    })

    it('creates error node on the download node when insertFileToWorkflow throws', async () => {
      const node = {id: 'download-node', title: '/download https://example.com'}
      downloadAndInsertSpy.mockRejectedValue(new Error('network timeout'))

      await command.run(node, 'https://example.com')

      expect(createNodesSpy).toHaveBeenCalledWith('Error: network timeout', 'download-node')
    })

    it('logs the error when insertFileToWorkflow throws', async () => {
      const node = {id: 'download-node', title: '/download https://example.com'}
      const err = new Error('network timeout')
      downloadAndInsertSpy.mockRejectedValue(err)
      const logSpy = jest.spyOn(command, 'logError')

      await command.run(node, 'https://example.com')

      expect(logSpy).toHaveBeenCalledWith(err)
      logSpy.mockRestore()
    })

    it('does not throw to caller when insertFileToWorkflow rejects', async () => {
      const node = {id: 'download-node', title: '/download https://example.com'}
      downloadAndInsertSpy.mockRejectedValue(new Error('fetch failed'))

      await expect(command.run(node, 'https://example.com')).resolves.toBeUndefined()
    })

    it('creates exactly one error node per download failure', async () => {
      const node = {id: 'download-node', title: '/download https://example.com'}
      downloadAndInsertSpy.mockRejectedValue(new Error('fetch failed'))

      await command.run(node, 'https://example.com')

      expect(createNodesSpy).toHaveBeenCalledTimes(1)
    })
  })
})
