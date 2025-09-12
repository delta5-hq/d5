import {NodeTextExtractor} from './NodeTextExtractor'
import WorkflowFile from '../../../../models/WorkflowFile'
import {extractTextFromPdf} from '../../../utils/pdf'
import Store from './Store'

jest.mock('../../../../models/WorkflowFile')
jest.mock('../../../utils/pdf', () => ({
  ...jest.requireActual('../../../utils/pdf'),
  extractTextFromPdf: jest.fn(),
}))

describe('NodeTextExtractor', () => {
  const maxSize = 1000
  const validateNode = jest.fn()
  const mockStore = new Store({userId: 'userId'})
  let nodeTextExtractor

  beforeEach(() => {
    jest.clearAllMocks()
    nodeTextExtractor = new NodeTextExtractor(maxSize, validateNode, mockStore)
    mockStore._nodes = {}
  })

  describe('extractNodeOnlyContent', () => {
    it('should return empty string when node is invalid', async () => {
      const node = {
        title: 'Test Node',
        file: undefined,
      }

      validateNode.mockReturnValue(true)

      const result = await nodeTextExtractor.extractNodeOnlyContent(node)
      expect(result).toBe('')
    })

    it('should extract title content when node has title', async () => {
      const node = {
        title: 'Test Node',
        file: undefined,
      }

      validateNode.mockReturnValue(false)

      const result = await nodeTextExtractor.extractNodeOnlyContent(node)
      expect(result).toBe('Test Node.')
    })

    it('should extract PDF content when node has PDF file', async () => {
      const node = {
        title: 'Test Node',
        file: 'test-file-id',
      }

      const mockPdfContent = 'PDF Content'
      validateNode.mockReturnValue(false)

      WorkflowFile.findOne.mockResolvedValue({
        metadata: {contentType: 'application/pdf'},
        read: () => {
          const chunks = [Buffer.from('PDF data')]
          return (async function* () {
            for (const chunk of chunks) {
              yield chunk
            }
          })()
        },
      })

      extractTextFromPdf.mockResolvedValue(mockPdfContent)

      const result = await nodeTextExtractor.extractNodeOnlyContent(node)
      expect(result).toBe('Test Node. PDF Content.')
    })

    it('should use cached file content when available', async () => {
      const node = {
        title: 'Test Node',
        file: 'test-file-id',
      }

      const mockPdfContent = 'PDF Content'
      validateNode.mockReturnValue(false)

      mockStore._files = {
        'test-file-id': mockPdfContent,
      }

      const result = await nodeTextExtractor.extractNodeOnlyContent(node)
      expect(result).toBe('Test Node. PDF Content.')
      expect(WorkflowFile.findOne).not.toHaveBeenCalled()
    })
  })

  describe('reference and hashref substitution', () => {
    it('should substitute references and hashrefs in node title', async () => {
      const refNode = {
        id: 'ref',
        title: '@ref reference',
        file: undefined,
        children: [],
        depth: 1,
      }
      const hashNode = {
        id: 'hash',
        title: '#_hash hashref',
        file: undefined,
        children: [],
        depth: 1,
      }
      const node = {
        id: 'main',
        title: 'Test @@ref and ##_hash',
        file: undefined,
        children: [],
        depth: 1,
      }
      mockStore._nodes = {
        ref: refNode,
        hash: hashNode,
        main: node,
      }
      validateNode.mockReturnValue(false)
      const result = await nodeTextExtractor.extractNodeOnlyContent(node)
      expect(result).toBe('Test reference and hashref.')
    })
  })

  describe('extractFullContent', () => {
    it('should extract content from node and all its children', async () => {
      const childNode1 = {
        id: 'child1',
        title: 'Child Node 1',
        file: undefined,
      }

      const childNode2 = {
        id: 'child2',
        title: 'Child Node 2',
        file: undefined,
      }

      const node = {
        id: 'parent',
        title: 'Parent Node',
        file: undefined,
        children: ['child1', 'child2'],
      }

      mockStore._nodes = {
        parent: node,
        child1: childNode1,
        child2: childNode2,
      }

      validateNode.mockReturnValue(false)

      const result = await nodeTextExtractor.extractFullContent(node)
      expect(result).toBe('Parent Node. Child Node 1. Child Node 2.')
    })

    it('should handle nested child nodes', async () => {
      const grandChild = {
        id: 'grandchild',
        title: 'Grand Child',
        file: undefined,
        children: [],
      }

      const child = {
        id: 'child',
        title: 'Child',
        file: undefined,
        children: ['grandchild'],
      }

      const node = {
        id: 'parent',
        title: 'Parent',
        file: undefined,
        children: ['child'],
      }

      mockStore._nodes = {
        parent: node,
        child: child,
        grandchild: grandChild,
      }

      validateNode.mockReturnValue(false)

      const result = await nodeTextExtractor.extractFullContent(node)
      expect(result).toBe('Parent. Child. Grand Child.')
    })
  })
})
