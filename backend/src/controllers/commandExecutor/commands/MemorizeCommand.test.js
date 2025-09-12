import {MemorizeCommand} from './MemorizeCommand'
import {ExtVectorStore} from './utils/langchain/vectorStore/ExtVectorStore'
import {determineLLMType, getIntegrationSettings} from './utils/langchain/getLLM'
import {getEmbeddings} from './utils/langchain/getLLM'
import {DEFAULT_CONTEXT_NAME} from '../constants/ext'
import {CHUNK_SIZE} from '../constants'
import {MEMORIZE_QUERY} from '../constants'
import WorkflowFile from '../../../models/WorkflowFile'
import {extractTextFromPdf} from '../../utils/pdf'
import Store from './utils/Store'

jest.mock('./utils/langchain/getLLM')
jest.mock('../../../models/WorkflowFile')
jest.mock('../../utils/pdf', () => ({
  ...jest.requireActual('../../utils/pdf'),
  extractTextFromPdf: jest.fn(),
}))

describe('MemorizeCommand', () => {
  const userId = 'userId'
  const mapId = 'mapId'
  const mockStore = new Store({userId, mapId, nodes: {}})
  const command = new MemorizeCommand(userId, mapId, mockStore)

  beforeEach(() => {
    command.logError = jest.fn()
    jest.clearAllMocks()
  })

  describe('getText', () => {
    it('should return empty string for node with no title and no children', async () => {
      const node = {id: 'node', title: undefined}

      mockStore._nodes = {
        [node.id]: node,
      }

      const result = await command.getText(node, 100)
      expect(result).toBe('')
    })

    it('should return title for node with title and no children', async () => {
      const node2 = {id: 'node', title: 'Title'}
      const node1 = {title: undefined, children: [node2.id]}

      mockStore._nodes = {
        [node2.id]: node2,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 100)
      expect(result).toBe('Title.')
    })

    it('should traverse child nodes and return concatenated titles', async () => {
      const node3 = {id: 'node3', title: 'Title2'}
      const node2 = {id: 'node2', title: 'Title1'}
      const node1 = {id: 'node1', title: undefined, children: [node2.id, node3.id]}

      mockStore._nodes = {
        [node3.id]: node3,
        [node2.id]: node2,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 100)
      expect(result).toBe('Title1. Title2.')
    })

    it('should respect maxSize limit', async () => {
      const node3 = {id: 'node3', title: 'Title2'}
      const node2 = {id: 'node2', title: 'Title1'}
      const node1 = {id: 'node1', title: undefined, children: [node2.id, node3.id]}

      mockStore._nodes = {
        [node3.id]: node3,
        [node2.id]: node2,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 1)
      expect(result).toBe('Title1')
    })

    it('should traverse nested nodes and return concatenated titles', async () => {
      const childNode2 = {id: 'childNode2', title: 'ChildNode2'}
      const node3 = {id: 'node3', title: 'Node3', children: [childNode2.id]}
      const childNode1 = {id: 'childNode1', title: 'ChildNode1'}
      const node2 = {id: 'node2', title: 'Node2', children: [childNode1.id]}
      const node1 = {
        id: 'node1',
        title: undefined,
        children: [node3.id, node2.id],
      }

      mockStore._nodes = {
        [node3.id]: node3,
        [childNode2.id]: childNode2,
        [node2.id]: node2,
        [childNode1.id]: childNode1,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 100)
      expect(result).toBe('Node3. ChildNode2. Node2. ChildNode1.')
    })

    it('should skip nodes with /memorize', async () => {
      const childNode2 = {id: 'childNode2', title: MEMORIZE_QUERY}
      const node3 = {id: 'node3', title: 'Node3', children: [childNode2.id]}
      const childNode1 = {id: 'childNode1', title: 'ChildNode1'}
      const node2 = {id: 'node2', title: MEMORIZE_QUERY, children: [childNode1.id]}
      const node1 = {
        id: 'node1',
        title: undefined,
        children: [node3.id, node2.id],
      }

      mockStore._nodes = {
        [node3.id]: node3,
        [childNode2.id]: childNode2,
        [node2.id]: node2,
        [childNode1.id]: childNode1,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 100)
      expect(result).toBe('Node3. ChildNode1.')
    })

    it('should use file content when node has file property', async () => {
      const childNode1 = {id: 'childNode1', title: 'ChildNode1', childNodes: new Set([])}
      const node1 = {id: 'node1', title: 'Title1', childNodes: new Set([childNode1])}
      const parentNode = {
        id: 'parentNode',
        title: 'Parent',
        file: 'id',
        childNodes: new Set([node1]),
      }

      mockStore._nodes = {
        [childNode1.id]: childNode1,
        [node1.id]: node1,
        [parentNode.id]: parentNode,
      }

      mockStore._files = {
        id: 'PDF data',
      }

      const result = await command.getText(parentNode, 100)
      expect(result).toBe('Parent. PDF data.')
    })

    it('should skip command', async () => {
      const child1 = {id: 'child1', title: 'Result'}
      const sumRes = {id: 'sumRes', title: 'Summary'}
      const child2 = {id: 'child2', title: '/summarize prompt', children: [sumRes.id], prompts: [sumRes.id]}

      const node3 = {id: 'node3', title: '/chatgpt any', children: [child2.id, child1.id], prompts: [child1.id]}
      child1.parent = node3.id
      child2.parent = node3.id

      const node2 = {id: 'node2', title: 'Title1'}
      const node1 = {id: 'node1', title: undefined, children: [node2.id, node3.id]}

      mockStore._nodes = {
        [node3.id]: node3,
        [node2.id]: node2,
        [node1.id]: node1,
        child1,
        sumRes,
        child2,
      }

      const result = await command.getText(node1, 1000)
      expect(result).toBe('Title1. Summary. Result.')
    })

    it('should skip command with steps prefix', async () => {
      const node3 = {id: 'node3', title: '/chatgpt any'}
      const node2 = {id: 'node2', title: 'Title1'}
      const node1 = {id: 'node1', title: undefined, children: [node2.id, node3.id]}

      mockStore._nodes = {
        [node3.id]: node3,
        [node2.id]: node2,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 1000)
      expect(result).toBe('Title1.')
    })
  })

  describe('getParams', () => {
    it('should extract parameters from command', () => {
      const commandStr = '/memorize --context=test --rechunk --xxl'
      const params = command.getParams(commandStr)

      expect(params).toEqual({
        context: 'test',
        rechunk: true,
        maxChunks: 'xxl',
        keep: false,
      })
    })

    it('should return default values when parameters are not present', () => {
      const commandStr = '/memorize'
      const params = command.getParams(commandStr)

      expect(params).toEqual({
        context: DEFAULT_CONTEXT_NAME,
        rechunk: false,
        maxChunks: CHUNK_SIZE.xs,
        keep: true,
      })
    })
  })

  describe('run', () => {
    beforeEach(() => {
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: 'test-key'},
      })
      determineLLMType.mockReturnValue('openai')
      getEmbeddings.mockReturnValue({
        embeddings: {},
        chunkSize: 1000,
        similarityThreshold: 0.7,
      })
      ExtVectorStore.prototype.load = jest.fn()
      jest.clearAllMocks()
    })

    it('should handle errors gracefully', async () => {
      const node = {
        id: 'node',
        command: '/memorize --context=test',
        parent: 'parent',
      }
      const parent = {
        id: 'parent',
      }

      mockStore._nodes = {
        node,
        parent,
      }

      ExtVectorStore.prototype.load.mockRejectedValue(new Error('Test error'))

      await command.run(node)

      expect(command.logError).toHaveBeenCalled()
    })

    it('should call processChunks with parent node', async () => {
      const child = {
        id: 'child',
        title: '/memorize',
        command: '/memorize',
        children: [],
        parent: 'parent',
      }
      const parent = {
        id: 'parent',
        title: 'Parent',
        children: [child.id],
      }

      mockStore._nodes = {
        child,
        parent,
      }

      const mockProcessChunks = jest.spyOn(command, 'processChunks').mockResolvedValueOnce([])

      const mockSaveEmbeddings = jest.spyOn(command, 'saveEmbeddings')
      mockSaveEmbeddings.mockResolvedValueOnce(undefined)

      await command.run(child)

      const callNodeArg = mockProcessChunks.mock.calls[0][0]
      expect(callNodeArg).toBe(parent)
    })

    it('hould call processChunks with split param', async () => {
      const child = {
        id: 'child',
        title: '/memorize --split',
        command: '/memorize --split',
        children: [],
        parent: 'parent',
      }
      const parent = {
        id: 'parent',
        title: 'Parent',
        children: [child.id],
      }

      mockStore._nodes = {
        child,
        parent,
      }

      const mockProcessChunks = jest.spyOn(command, 'processChunks').mockResolvedValueOnce([])

      const mockSaveEmbeddings = jest.spyOn(command, 'saveEmbeddings')
      mockSaveEmbeddings.mockResolvedValueOnce(undefined)

      await command.run(child)

      expect(mockProcessChunks).toHaveBeenCalledWith(parent, false, expect.objectContaining({split: '\n'}))
    })

    it('hould call processChunks with provided split param', async () => {
      const child = {
        id: 'child',
        title: '/memorize --split="."',
        command: '/memorize --split="."',
        children: [],
        parent: 'parent',
      }
      const parent = {
        id: 'parent',
        title: 'Parent',
        children: [child.id],
      }

      mockStore._nodes = {
        child,
        parent,
      }

      const mockProcessChunks = jest.spyOn(command, 'processChunks').mockResolvedValueOnce([])

      const mockSaveEmbeddings = jest.spyOn(command, 'saveEmbeddings')
      mockSaveEmbeddings.mockResolvedValueOnce(undefined)

      await command.run(child)

      expect(mockProcessChunks).toHaveBeenCalledWith(parent, false, expect.objectContaining({split: '.'}))
    })
  })

  describe('processChunks', () => {
    it('should process chunks with PDF content and nested nodes correctly', async () => {
      const nestedChild = {
        id: 'nestedChild',
        title: 'Nested Content',
        children: [],
        parent: 'child1',
      }

      const child1 = {
        id: 'child1',
        title: 'Child 1',
        children: ['nestedChild'],
        parent: 'parent',
      }

      const child2 = {
        id: 'child2',
        title: '/memorize',
        children: [],
        parent: 'parent',
      }

      const child3 = {
        id: 'child3',
        title: 'Child 3',
        children: [],
        parent: 'parent',
      }

      const parentNode = {
        id: 'parent',
        title: 'Parent Title',
        file: 'test.pdf',
        children: ['child1', 'child2', 'child3'],
      }

      mockStore._nodes = {
        parent: parentNode,
        child1,
        child2,
        child3,
        nestedChild,
      }

      const mockFileData = {
        metadata: {
          contentType: 'application/pdf',
        },
        read: () => {
          const chunks = [Buffer.from('PDF content')]
          return {
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) {
                yield chunk
              }
            },
          }
        },
      }

      WorkflowFile.findOne.mockResolvedValue(mockFileData)
      extractTextFromPdf.mockResolvedValue('PDF content')

      const chunks = await command.processChunks(parentNode, false, {maxChunks: 'm'})

      expect(chunks).toHaveLength(3) // Parent + Child1 + Child3 (excluding /memorize node)
      expect(chunks[0]).toEqual({
        content: 'Parent Title. PDF content.',
        hrefs: ['parent'],
      })
    })

    it('should process chunks with split param', async () => {
      const nestedChild = {
        id: 'nestedChild',
        title: 'Nested Content',
        children: [],
        parent: 'child1',
      }

      const child1 = {
        id: 'child1',
        title: 'Child 1',
        children: ['nestedChild'],
        parent: 'parent',
      }

      const child2 = {
        id: 'child2',
        title: '/memorize',
        children: [],
        parent: 'parent',
      }

      const child3 = {
        id: 'child3',
        title: 'Child 3',
        children: [],
        parent: 'parent',
      }

      const parentNode = {
        id: 'parent',
        title: 'Parent Title',
        file: 'test.pdf',
        children: ['child1', 'child2', 'child3'],
      }

      mockStore._nodes = {
        parent: parentNode,
        child1,
        child2,
        child3,
        nestedChild,
      }

      const mockFileData = {
        metadata: {
          contentType: 'application/pdf',
        },
        read: () => {
          const chunks = [Buffer.from('PDF content\nSecond page')]
          return {
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) {
                yield chunk
              }
            },
          }
        },
      }

      WorkflowFile.findOne.mockResolvedValue(mockFileData)
      extractTextFromPdf.mockResolvedValue('PDF content\nSecond page')

      const chunks = await command.processChunks(parentNode, true, {split: '\n'})

      expect(chunks).toHaveLength(2)
      expect(chunks).toEqual([
        {content: 'Parent Title. PDF content', hrefs: ['parent']},
        {content: 'Second page. Child 1. Nested Content. Child 3.', hrefs: ['parent']},
      ])
    })

    it('should process chunks with split param', async () => {
      const nestedChild = {
        id: 'nestedChild',
        title: 'Nested Content',
        children: [],
        parent: 'child1',
      }

      const child1 = {
        id: 'child1',
        title: 'Child 1',
        children: ['nestedChild'],
        parent: 'parent',
      }

      const child2 = {
        id: 'child2',
        title: '/memorize',
        children: [],
        parent: 'parent',
      }

      const child3 = {
        id: 'child3',
        title: 'Child 3',
        children: [],
        parent: 'parent',
      }

      const parentNode = {
        id: 'parent',
        title: 'Parent Title',
        file: 'test.pdf',
        children: ['child1', 'child2', 'child3'],
      }

      mockStore._nodes = {
        parent: parentNode,
        child1,
        child2,
        child3,
        nestedChild,
      }

      const mockFileData = {
        metadata: {
          contentType: 'application/pdf',
        },
        read: () => {
          const chunks = [Buffer.from('PDF content\nSecond page')]
          return {
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) {
                yield chunk
              }
            },
          }
        },
      }

      WorkflowFile.findOne.mockResolvedValue(mockFileData)
      extractTextFromPdf.mockResolvedValue('PDF content\nSecond page')

      const chunks = await command.processChunks(parentNode, false, {split: '\n'})

      expect(chunks).toHaveLength(4)
      expect(chunks).toEqual([
        {content: 'Parent Title. PDF content', hrefs: ['parent']},
        {content: 'Second page.', hrefs: ['parent']},
        {content: 'Child 3.', hrefs: ['child3']},
        {content: 'Child 1. Nested Content.', hrefs: ['child1']},
      ])
    })
  })
})
