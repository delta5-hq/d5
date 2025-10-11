import {scrapeFiles} from '../../utils/scrape'
import {DownloadCommand} from './DownloadCommand'

// Mock the reference patterns module
jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
}))

// Mock the constants module before importing from it
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

// Import constants after mocking
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
    it('should return empty array if no URLs are found', async () => {
      const result = await command.insertFileToWorkflow({}, '', {})
      expect(result).toEqual([])
    })

    it('should insert new files and create nodes for existing files', async () => {
      scrapeFiles.mockResolvedValue([{filename: 'test.txt', content: 'file content'}])

      mockStore._nodes = {}
      await command.insertFileToWorkflow({id: 'parent'}, 'https://test.com')

      const createdNode = mockStore._nodes['mocked-node-id']

      expect(createdNode).toEqual({
        id: 'mocked-node-id',
        file: 'mocked-file-id',
        title: 'test.txt',
        parent: 'parent',
      })
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

      // Override the mock specifically for this test
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

      // Check specifically that the second argument (URL) is what we expect
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
      // Check specifically that the second argument (prompt) is what we expect
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
      // Check specifically that the second argument (cleared prompt) is what we expect
      expect(downloadAndInsertSpy.mock.calls[0][1]).toBe('cleared https://example.com')
    })
  })
})
