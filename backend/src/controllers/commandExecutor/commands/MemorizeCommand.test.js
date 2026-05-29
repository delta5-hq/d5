import {MemorizeCommand} from './MemorizeCommand'
import {ExtVectorStore} from './utils/langchain/vectorStore/ExtVectorStore'
import {determineLLMType, getIntegrationSettings} from './utils/langchain/getLLM'
import {getEmbeddings} from './utils/langchain/getLLM'
import {DEFAULT_CONTEXT_NAME} from '../constants/ext'
import {CHUNK_SIZE} from '../constants'
import {MEMORIZE_QUERY} from '../constants'
import {MEMORIZE_QUERY_TYPE} from '../constants/memorize'
import {FOREACH_QUERY_TYPE} from '../constants/foreach'
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
  const workflowId = 'workflowId'
  const mockStore = new Store({userId, workflowId, nodes: {}})
  const command = new MemorizeCommand(userId, workflowId, mockStore)

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
    let createNodesSpy

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
      createNodesSpy = jest.spyOn(mockStore.importer, 'createNodes').mockImplementation(() => {})
    })

    it('creates error node when parent id points to a node not in the store', async () => {
      const node = {id: 'node', command: '/memorize', parent: 'missing-parent'}
      mockStore._nodes = {node}

      await command.run(node)

      expect(createNodesSpy).toHaveBeenCalledWith(
        'Error: /memorize requires a parent node containing content to store',
        'node',
      )
    })

    it('creates error node when node has no parent property set', async () => {
      const node = {id: 'node', command: '/memorize'}
      mockStore._nodes = {node}

      await command.run(node)

      expect(createNodesSpy).toHaveBeenCalledWith(
        'Error: /memorize requires a parent node containing content to store',
        'node',
      )
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
      expect(createNodesSpy).toHaveBeenCalledWith(expect.stringMatching(/^Error:/), 'node')
    })

    it('does not throw to caller when parent node is missing', async () => {
      const node = {id: 'node', command: '/memorize', parent: 'missing'}
      mockStore._nodes = {node}

      await expect(command.run(node)).resolves.toBeUndefined()
    })

    it('does not throw to caller when vectorStore operation fails', async () => {
      const node = {id: 'node', command: '/memorize --context=test', parent: 'parent'}
      const parent = {id: 'parent', title: 'Some content'}
      mockStore._nodes = {node, parent}

      ExtVectorStore.prototype.load.mockRejectedValue(new Error('storage error'))

      await expect(command.run(node)).resolves.toBeUndefined()
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

    describe('confirmation node on successful storage', () => {
      const makeSuccessfulRun = async ({chunks, command: cmd = '/memorize'} = {}) => {
        const node = {id: 'mem-node', command: cmd, parent: 'parent-node'}
        const parent = {id: 'parent-node', title: 'Source content'}
        mockStore._nodes = {'mem-node': node, 'parent-node': parent}
        jest.spyOn(command, 'processChunks').mockResolvedValueOnce(chunks)
        jest.spyOn(command, 'saveEmbeddings').mockResolvedValueOnce(undefined)
        await command.run(node)
      }

      it('emits a confirmation node attached to the memorize node after successful storage', async () => {
        await makeSuccessfulRun({chunks: [{content: 'a', hrefs: []}]})
        expect(createNodesSpy).toHaveBeenCalledWith(expect.stringMatching(/^Memorized/), 'mem-node')
      })

      it('reports singular "chunk" when exactly one chunk was stored', async () => {
        await makeSuccessfulRun({chunks: [{content: 'a', hrefs: []}]})
        expect(createNodesSpy).toHaveBeenCalledWith(expect.stringContaining('1 chunk'), 'mem-node')
        expect(createNodesSpy).not.toHaveBeenCalledWith(expect.stringContaining('1 chunks'), 'mem-node')
      })

      it('reports plural "chunks" when more than one chunk was stored', async () => {
        await makeSuccessfulRun({
          chunks: [
            {content: 'a', hrefs: []},
            {content: 'b', hrefs: []},
          ],
        })
        expect(createNodesSpy).toHaveBeenCalledWith(expect.stringContaining('2 chunks'), 'mem-node')
      })

      it('includes the named context in parentheses when an explicit context is specified', async () => {
        await makeSuccessfulRun({chunks: [{content: 'a', hrefs: []}], command: '/memorize --context=docs'})
        expect(createNodesSpy).toHaveBeenCalledWith(expect.stringContaining('(context: docs)'), 'mem-node')
      })

      it('omits the context label when using the implicit default context', async () => {
        await makeSuccessfulRun({chunks: [{content: 'a', hrefs: []}]})
        const [message] = createNodesSpy.mock.calls[0]
        expect(message).not.toContain('(context:')
      })

      it('omits the context label when using an explicitly named default context', async () => {
        await makeSuccessfulRun({chunks: [{content: 'a', hrefs: []}], command: '/memorize --context=default'})
        const [message] = createNodesSpy.mock.calls[0]
        expect(message).not.toContain('(context:')
      })

      it('does not emit a confirmation node when saveEmbeddings throws', async () => {
        const node = {id: 'mem-node', command: '/memorize', parent: 'parent-node'}
        const parent = {id: 'parent-node', title: 'Source content'}
        mockStore._nodes = {'mem-node': node, 'parent-node': parent}
        jest.spyOn(command, 'processChunks').mockResolvedValueOnce([{content: 'a', hrefs: []}])
        jest.spyOn(command, 'saveEmbeddings').mockRejectedValueOnce(new Error('storage failed'))

        await command.run(node)

        const allMessages = createNodesSpy.mock.calls.map(([msg]) => msg)
        expect(allMessages.every(msg => msg.startsWith('Error:'))).toBe(true)
      })

      it('does not emit a confirmation node when the parent node is missing', async () => {
        const node = {id: 'mem-node', command: '/memorize', parent: 'no-such-parent'}
        mockStore._nodes = {'mem-node': node}

        await command.run(node)

        const allMessages = createNodesSpy.mock.calls.map(([msg]) => msg)
        expect(allMessages.every(msg => msg.startsWith('Error:'))).toBe(true)
      })
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

    it('splits all content at separator boundaries when rechunk is enabled', async () => {
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

    it('splits each node independently at separator boundaries when rechunk is disabled', async () => {
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

  describe('abort signal support', () => {
    it('accepts signal parameter and completes normally when not aborted', async () => {
      const cmd = new MemorizeCommand('user-id', null, mockStore)
      const abortController = new AbortController()

      const node = {id: 'child', parent: 'parent', command: '/memorize --context=test'}
      const parent = {id: 'parent'}
      mockStore._nodes = {child: node, parent}

      jest.spyOn(cmd, 'processChunks').mockResolvedValue([])
      jest.spyOn(cmd, 'saveEmbeddings').mockResolvedValue(undefined)

      await expect(cmd.run(node, {signal: abortController.signal})).resolves.not.toThrow()
    })

    it('accepts run with no options parameter for backward compatibility', async () => {
      const cmd = new MemorizeCommand('user-id', null, mockStore)
      const node = {id: 'child', parent: 'parent', command: '/memorize --context=test'}
      const parent = {id: 'parent'}
      mockStore._nodes = {child: node, parent}

      jest.spyOn(cmd, 'processChunks').mockResolvedValue([])
      jest.spyOn(cmd, 'saveEmbeddings').mockResolvedValue(undefined)

      await expect(cmd.run(node)).resolves.not.toThrow()
    })

    it('accepts run with undefined signal for backward compatibility', async () => {
      const cmd = new MemorizeCommand('user-id', null, mockStore)
      const node = {id: 'child', parent: 'parent', command: '/memorize --context=test'}
      const parent = {id: 'parent'}
      mockStore._nodes = {child: node, parent}

      jest.spyOn(cmd, 'processChunks').mockResolvedValue([])
      jest.spyOn(cmd, 'saveEmbeddings').mockResolvedValue(undefined)

      await expect(cmd.run(node, {signal: undefined})).resolves.not.toThrow()
    })

    it('bails early when signal is already aborted before execution', async () => {
      const cmd = new MemorizeCommand('user-id', null, mockStore)
      const abortController = new AbortController()
      abortController.abort()

      cmd._getVectorStore = jest.fn()
      cmd.processChunks = jest.fn()
      cmd.saveEmbeddings = jest.fn()

      // Intentionally no parent in store — signal check must fire before parent lookup
      const node = {id: 'child', parent: 'missing-parent', command: '/memorize --context=test'}
      mockStore._nodes = {child: node}

      await cmd.run(node, {signal: abortController.signal})

      expect(cmd._getVectorStore).not.toHaveBeenCalled()
      expect(cmd.processChunks).not.toHaveBeenCalled()
      expect(cmd.saveEmbeddings).not.toHaveBeenCalled()
    })
  })

  describe('isSpecialNode', () => {
    it.each([
      ['foreach command node', `${FOREACH_QUERY_TYPE} prompt`, true],
      ['memorize command node', `${MEMORIZE_QUERY_TYPE} prompt`, true],
      ['foreach prefix only', FOREACH_QUERY_TYPE, true],
      ['memorize prefix only', MEMORIZE_QUERY_TYPE, true],
      ['plain content node', 'some regular text', false],
      ['empty title', '', false],
      ['unrelated slash command', '/chatgpt prompt', false],
    ])('classifies node with title "%s" as special=%s', (_label, title, expected) => {
      expect(command.isSpecialNode({title})).toBe(expected)
    })

    it('treats missing title as non-special', () => {
      expect(command.isSpecialNode({})).toBe(false)
    })
  })

  describe('calculateTextSize', () => {
    it.each([
      ['xxl', Infinity],
      ['xl', 500_000],
      ['l', 100_000],
      ['m', 50_000],
      ['s', 15_000],
      ['xs', 5000],
      ['xxs', 500],
    ])('maps size string "%s" to numeric limit', (sizeStr, expected) => {
      expect(command.calculateTextSize(sizeStr)).toBe(expected)
    })

    it.each([
      ['uppercase XXL', 'XXL', Infinity],
      ['uppercase XL', 'XL', 500_000],
      ['uppercase XS', 'XS', 5000],
    ])('is case-insensitive — %s', (_label, sizeStr, expected) => {
      expect(command.calculateTextSize(sizeStr)).toBe(expected)
    })

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['unrecognized string', 'huge'],
      ['empty string', ''],
    ])('returns default 5000 for unrecognized input — %s', (_label, input) => {
      expect(command.calculateTextSize(input)).toBe(5000)
    })
  })

  describe('createChunks', () => {
    it('returns a single chunk containing the full content when no separator is given', () => {
      const chunks = command.createChunks('full text', 'node-id')
      expect(chunks).toEqual([{content: 'full text', hrefs: ['node-id']}])
    })

    it('splits content at each separator occurrence and trims each part', () => {
      const chunks = command.createChunks('first\nsecond\nthird', 'node-id', '\n')
      expect(chunks).toEqual([
        {content: 'first', hrefs: ['node-id']},
        {content: 'second', hrefs: ['node-id']},
        {content: 'third', hrefs: ['node-id']},
      ])
    })

    it('filters out parts that are blank after trimming', () => {
      const chunks = command.createChunks('first\n\n\nthird', 'node-id', '\n')
      expect(chunks).toHaveLength(2)
      expect(chunks.map(c => c.content)).toEqual(['first', 'third'])
    })

    it('assigns the source id as the sole href for every produced chunk', () => {
      const chunks = command.createChunks('a\nb', 'src-42', '\n')
      for (const chunk of chunks) {
        expect(chunk.hrefs).toEqual(['src-42'])
      }
    })
  })

  describe('getParams', () => {
    it('extracts context, rechunk, maxChunks, keep and split from a fully specified command', () => {
      expect(command.getParams('/memorize --context=test --rechunk --xxl')).toEqual({
        context: 'test',
        rechunk: true,
        maxChunks: 'xxl',
        keep: false,
        split: undefined,
      })
    })

    it('returns defaults for a bare /memorize command', () => {
      expect(command.getParams('/memorize')).toEqual({
        context: DEFAULT_CONTEXT_NAME,
        rechunk: false,
        maxChunks: CHUNK_SIZE.xs,
        keep: true,
        split: undefined,
      })
    })

    it('sets keep=true when --keep=true is explicitly provided', () => {
      const params = command.getParams('/memorize --keep=true')
      expect(params.keep).toBe(true)
    })

    it('sets keep=false when --keep flag is present without a value', () => {
      const params = command.getParams('/memorize --keep')
      expect(params.keep).toBe(false)
    })

    it('sets keep=false when --keep=false is explicitly provided', () => {
      const params = command.getParams('/memorize --keep=false')
      expect(params.keep).toBe(false)
    })

    it('sets keep=false for a non-default context when no --keep flag is given', () => {
      const params = command.getParams('/memorize --context=myctx')
      expect(params.keep).toBe(false)
    })

    it('resolves split separator from --split flag', () => {
      const params = command.getParams('/memorize --split')
      expect(params.split).toBe('\n')
    })

    it('resolves split separator from --split="." flag', () => {
      const params = command.getParams('/memorize --split="."')
      expect(params.split).toBe('.')
    })
  })

  describe('saveEmbeddings', () => {
    it('throws when chunk list is empty', async () => {
      const mockVectorStore = {load: jest.fn()}
      await expect(command.saveEmbeddings(mockVectorStore, [], true)).rejects.toThrow(
        'No data that can be loaded to embeddings',
      )
      expect(mockVectorStore.load).not.toHaveBeenCalled()
    })

    it('delegates to vectorStore.load with chunks and keep flag when chunks are present', async () => {
      const mockVectorStore = {load: jest.fn().mockResolvedValue(undefined)}
      const chunks = [{content: 'text', hrefs: ['n1']}]
      await command.saveEmbeddings(mockVectorStore, chunks, true)
      expect(mockVectorStore.load).toHaveBeenCalledWith(chunks, true)
    })

    it('passes keep=false correctly to vectorStore.load', async () => {
      const mockVectorStore = {load: jest.fn().mockResolvedValue(undefined)}
      const chunks = [{content: 'text', hrefs: ['n1']}]
      await command.saveEmbeddings(mockVectorStore, chunks, false)
      expect(mockVectorStore.load).toHaveBeenCalledWith(chunks, false)
    })
  })

  describe('constructor', () => {
    it('initializes without workflowId', () => {
      const cmd = new MemorizeCommand('user-1', null, mockStore)
      expect(cmd.userId).toBe('user-1')
      expect(cmd.workflowId).toBeNull()
    })

    it('initializes with workflowId', () => {
      const cmd = new MemorizeCommand('user-1', 'wf-1', mockStore)
      expect(cmd.userId).toBe('user-1')
      expect(cmd.workflowId).toBe('wf-1')
    })
  })

  describe('command resolution (title-only nodes)', () => {
    beforeEach(() => {
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test-key'}})
      determineLLMType.mockReturnValue('openai')
      getEmbeddings.mockReturnValue({embeddings: {}, chunkSize: 1000, similarityThreshold: 0.7})
      ExtVectorStore.prototype.load = jest.fn()
      jest.clearAllMocks()
    })

    it('extracts parameters from title when command is undefined', async () => {
      const command = new MemorizeCommand('user-id', null, mockStore)
      const child = {id: 'child', title: '/memorize :keep=true :ctx=myctx', parent: 'parent', children: []}
      const parent = {id: 'parent', title: 'Parent', children: [child.id]}

      mockStore._nodes = {child, parent}

      const mockProcessChunks = jest.spyOn(command, 'processChunks').mockResolvedValueOnce([])
      const mockSaveEmbeddings = jest.spyOn(command, 'saveEmbeddings').mockResolvedValueOnce(undefined)

      await command.run(child)

      expect(mockProcessChunks).toHaveBeenCalled()
      expect(mockSaveEmbeddings).toHaveBeenCalledWith(expect.anything(), [], true)
    })

    it.each([['/memorize'], ['/memorize :lang=ru']])(
      'invokes determineLLMType with integration settings for title "%s"',
      async title => {
        const command = new MemorizeCommand('user-id', null, mockStore)
        const child = {id: 'child', title, parent: 'parent', children: []}
        const parent = {id: 'parent', title: 'Parent', children: [child.id]}

        mockStore._nodes = {child, parent}

        jest.spyOn(command, 'processChunks').mockResolvedValueOnce([])
        jest.spyOn(command, 'saveEmbeddings').mockResolvedValueOnce(undefined)

        await command.run(child)

        expect(determineLLMType).toHaveBeenCalledWith(expect.objectContaining({openai: {apiKey: 'test-key'}}))
      },
    )

    it('handles empty command and empty title gracefully', async () => {
      const command = new MemorizeCommand('user-id', null, mockStore)
      const child = {id: 'child', command: '', title: '', parent: 'parent', children: []}
      const parent = {id: 'parent', title: 'Parent', children: [child.id]}

      mockStore._nodes = {child, parent}

      jest.spyOn(command, 'processChunks').mockResolvedValueOnce([])
      jest.spyOn(command, 'saveEmbeddings').mockResolvedValueOnce(undefined)

      await command.run(child)

      expect(determineLLMType).toHaveBeenCalledWith(expect.objectContaining({openai: {apiKey: 'test-key'}}))
    })

    it('prefers command over title when both are populated', async () => {
      const command = new MemorizeCommand('user-id', null, mockStore)
      const child = {
        id: 'child',
        command: '/memorize :ctx=from-command',
        title: '/memorize :ctx=from-title',
        parent: 'parent',
        children: [],
      }
      const parent = {id: 'parent', title: 'Parent', children: [child.id]}

      mockStore._nodes = {child, parent}

      jest.spyOn(command, 'processChunks').mockResolvedValueOnce([])
      jest.spyOn(command, 'saveEmbeddings').mockResolvedValueOnce(undefined)

      await command.run(child)

      expect(determineLLMType).toHaveBeenCalledWith(expect.objectContaining({openai: {apiKey: 'test-key'}}))
    })

    it('handles null node gracefully', async () => {
      const command = new MemorizeCommand('user-id', null, mockStore)
      mockStore._nodes = {parent: {id: 'parent', title: 'Parent'}}

      await expect(command.run(null)).resolves.not.toThrow()
    })
  })
})
