import {scrapeFiles} from '../../utils/scrape'
import {DownloadCommand} from './DownloadCommand'

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
import WorkflowFile from '../../../models/WorkflowFile'
import {generateNodeId} from '../../../shared/utils/generateId'

jest.mock('../../utils/scrape')
jest.mock('../../../shared/utils/generateId', () => ({
  generateNodeId: jest.fn(),
}))
jest.mock('../../../models/WorkflowFile', () => ({
  write: jest.fn(() => Promise.resolve({_id: 'mocked-file-id'})),
}))
jest.mock('./references/substitution')

describe('DownloadCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  let mockStore
  let command
  let nextNodeId

  beforeEach(() => {
    jest.clearAllMocks()
    nextNodeId = 0
    generateNodeId.mockImplementation(() => `mocked-node-id-${++nextNodeId}`)
    WorkflowFile.write.mockResolvedValue({_id: 'mocked-file-id'})
    mockStore = new Store({
      userId,
      workflowId,
      nodes: {},
    })
    command = new DownloadCommand(userId, workflowId, mockStore)
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
    const parentNode = () => {
      const parent = {id: 'parent', children: []}
      mockStore._nodes = {parent}
      return parent
    }

    const visibleFailureTitles = parent =>
      (parent.prompts ?? []).map(id => mockStore._nodes[id]?.title).filter(title => title?.startsWith('Download '))

    it('returns an empty outcome and does not scrape when no URLs are found', async () => {
      const result = await command.insertFileToWorkflow({}, '', {})
      expect(result).toEqual({urls: [], createdNodes: [], duplicatedNodes: [], failures: []})
      expect(scrapeFiles).not.toHaveBeenCalled()
    })

    it('creates visible file nodes for every newly downloaded file', async () => {
      scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'file content'}])

      const parent = parentNode()
      const result = await command.insertFileToWorkflow(parent, 'https://test.com')

      const createdNode = mockStore._nodes['mocked-node-id-1']

      expect(createdNode).toEqual({
        id: 'mocked-node-id-1',
        file: 'mocked-file-id',
        title: 'test.txt',
        parent: 'parent',
      })
      expect(result).toEqual({
        urls: ['https://test.com'],
        createdNodes: [createdNode],
        duplicatedNodes: [],
        failures: [],
      })
      expect(visibleFailureTitles(parent)).toEqual([])
    })

    it('links duplicate downloaded content to the parent without creating a failure node', async () => {
      mockStore._files = {'existing-file-id': 'file content'}
      scrapeFiles.mockResolvedValue([{filename: 'duplicate.txt', content: 'file content'}])

      const parent = parentNode()
      const result = await command.insertFileToWorkflow(parent, 'https://test.com')

      expect(mockStore._nodes['mocked-node-id-1']).toEqual({
        id: 'mocked-node-id-1',
        file: 'existing-file-id',
        title: 'duplicate.txt',
        parent: 'parent',
      })
      expect(result.createdNodes).toEqual([])
      expect(result.duplicatedNodes).toEqual([mockStore._nodes['mocked-node-id-1']])
      expect(result.failures).toEqual([])
      expect(visibleFailureTitles(parent)).toEqual([])
    })

    it.each([
      {
        name: 'scrape returns no files',
        arrange: () => scrapeFiles.mockResolvedValue([]),
        expectedTitle: 'Download produced no files for https://test.com',
      },
      {
        name: 'scrape throws',
        arrange: () => scrapeFiles.mockRejectedValue(new Error('network unavailable')),
        expectedTitle: 'Download failed for https://test.com: network unavailable',
      },
      {
        name: 'all uploads fail',
        arrange: () => {
          scrapeFiles.mockResolvedValue([{filename: 'failed.txt', content: 'file content'}])
          WorkflowFile.write.mockRejectedValue(new Error('gridfs unavailable'))
        },
        expectedTitle: 'Download failed to persist failed.txt',
      },
    ])('creates a visible failure node when $name', async ({arrange, expectedTitle}) => {
      arrange()

      const parent = parentNode()
      const result = await command.insertFileToWorkflow(parent, 'https://test.com')

      expect(visibleFailureTitles(parent)).toEqual([expectedTitle])
      expect(result.urls).toEqual(['https://test.com'])
    })

    it('surfaces upload failures even when another file from the same scrape succeeds', async () => {
      scrapeFiles.mockResolvedValue([
        {filename: 'ok.txt', content: 'ok content'},
        {filename: 'failed.txt', content: 'failed content'},
      ])
      WorkflowFile.write
        .mockResolvedValueOnce({_id: 'ok-file-id'})
        .mockRejectedValueOnce(new Error('gridfs unavailable'))

      const parent = parentNode()
      const result = await command.insertFileToWorkflow(parent, 'https://test.com')

      expect(result.createdNodes).toEqual([
        expect.objectContaining({
          file: 'ok-file-id',
          title: 'ok.txt',
          parent: 'parent',
        }),
      ])
      expect(result.failures).toEqual([{file: 'failed.txt', error: expect.any(Error)}])
      expect(visibleFailureTitles(parent)).toEqual(['Download failed to persist failed.txt'])
    })
  })

  describe('run', () => {
    let downloadAndInsertSpy

    beforeEach(() => {
      downloadAndInsertSpy = jest.spyOn(command, 'insertFileToWorkflow').mockResolvedValue([])
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
  })
})
