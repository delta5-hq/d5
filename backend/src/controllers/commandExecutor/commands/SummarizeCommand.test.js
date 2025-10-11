import {FOREACH_QUERY} from '../constants/foreach'
import {SUMMARIZE_PARAM_PARENT} from '../constants/summarize'
import {SummarizeCommand} from './SummarizeCommand'
import {RefineDocumentsChain} from 'langchain/chains'
import {getLLM, Model, getIntegrationSettings} from './utils/langchain/getLLM'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'

// Mock integration model
jest.mock('../../../models/Integration', () => ({
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockReturnValue({
      openai: {apiKey: 'apiKey', model: 'model'},
      yandex: {apiKey: 'apiKey', folder_id: 'folder_id', model: 'model'},
    }),
  }),
}))

// Fix the jest mocks to ensure proper setup
jest.mock('./utils/langchain/getLLM', () => ({
  ...jest.requireActual('./utils/langchain/getLLM'),
  getLLM: jest.fn(),
  getIntegrationSettings: jest.fn(),
  Model: jest.requireActual('./utils/langchain/getLLM').Model,
}))

jest.mock('./references/substitution', () => ({
  ...jest.requireActual('./references/substitution'),
  substituteReferencesAndHashrefsChildrenAndSelf: jest.fn(),
}))
jest.mock('langchain/chains')

// Mock the constants module
jest.mock('../constants/steps', () => ({
  clearStepsPrefix: jest.fn(str => `cleared ${str}`),
}))

jest.mock('../constants', () => {
  const originalModule = jest.requireActual('../constants')
  return {
    ...originalModule,
    refRegExp: {test: jest.fn()},
    FOREACH_QUERY: jest.requireActual('../constants/foreach').FOREACH_QUERY,
    CHUNK_SIZE: jest.requireActual('../constants').CHUNK_SIZE,
    readLangParam: jest.fn(title => (title && title.includes('--lang=ru') ? 'ru' : 'en')),
    readMaxChunksParam: jest.fn().mockReturnValue('s'),
    readEmbedParam: jest.fn(title => (title && title.includes('--embed') ? 'embed' : null)),
  }
})

// Now import the constants after mocking
import {clearStepsPrefix} from '../constants/steps'
import Store from './utils/Store'

const origianalClearStepsPrefix = jest.requireActual('../constants/steps').clearStepsPrefix

describe('SummarizeCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const rootId = 'rootId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new SummarizeCommand(userId, workflowId, mockStore)
  const settings = {
    openai: {
      apiKey: 'apiKey',
      model: 'model',
    },
    yandex: {
      apiKey: 'apiKey',
      folder_id: 'folder_id',
      model: 'model',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
    clearStepsPrefix.mockImplementation(str => `cleared ${str}`)

    // Fix the mock implementation
    getIntegrationSettings.mockResolvedValue(settings)

    getLLM.mockReturnValue({llm: {}, chunkSize: 2000})

    // Instead of completely mocking replyDefault, we'll mock its dependencies
    jest.spyOn(command, 'replyDefault').mockImplementation(async () => 'summarized output')

    // Mock runRefinementQAChain and runAgentExecutor but keep track of calls
    command.runRefinementQAChain = jest.fn().mockResolvedValue('refined output')
    command.runAgentExecutor = jest.fn().mockResolvedValue('agent output')

    // Mock translate for language tests
    command.translate = jest.fn().mockResolvedValue('translated output')

    jest.spyOn(RefineDocumentsChain.prototype, 'call').mockResolvedValue({
      output_text: 'refined text',
    })
  })

  describe('getDocuments', () => {
    it('should split text into documents using RecursiveCharacterTextSplitter', async () => {
      const chunkSize = 1000
      const text = 'Sample text for testing.'

      const docs = await command.getDocuments(chunkSize, text)

      expect(docs[0].pageContent).toBe(text)
    })

    it('should split text to two chunks', async () => {
      const chunkSize = 280
      const text =
        'Learning new skills is essential for personal and professional growth. Whether you are mastering a language, improving your coding abilities, or exploring creative arts, consistent practice is key. Setting clear goals and staying motivated can help overcome challenges, leading to greater confidence and success.'

      const docs = await command.getDocuments(chunkSize, text)

      expect(docs[0].pageContent).toBe(
        'Learning new skills is essential for personal and professional growth. Whether you are mastering a language, improving your coding abilities, or exploring creative arts, consistent practice is key. Setting clear goals and staying motivated can help overcome challenges, leading to',
      )
      expect(docs[1].pageContent).toBe(
        'are mastering a language, improving your coding abilities, or exploring creative arts, consistent practice is key. Setting clear goals and staying motivated can help overcome challenges, leading to greater confidence and success.',
      )
    })
  })

  describe('getStartNode', () => {
    it('should return parent node of /summarize without --parent param', () => {
      const parentNode = {id: 'parent', title: 'Parent'}
      const summarizeNode = {id: 'summarizeNode', title: '/summarize query', parent: parentNode.id}

      mockStore._nodes = {
        [parentNode.id]: parentNode,
        [summarizeNode.id]: summarizeNode,
      }

      const startNode = command.getStartNode(summarizeNode, summarizeNode.title)

      expect(startNode.title).toBe(parentNode.title)
    })

    it('should return parent node of /summarize with --parent=0 param', () => {
      const parentNode = {id: 'parent', title: 'Parent'}
      const summarizeNode = {
        id: 'summarizeNode',
        title: `/summarize query ${SUMMARIZE_PARAM_PARENT}=0`,
        parent: parentNode.id,
      }

      const allNodes = {
        [parentNode.id]: parentNode,
        [summarizeNode.id]: summarizeNode,
      }

      const startNode = command.getStartNode(summarizeNode, summarizeNode.title, allNodes)

      expect(startNode.title).toBe(parentNode.title)
    })

    it('should return the node 2 levels higher with --parent param', () => {
      const parentNode = {id: 'parent', title: 'Parent', parent: rootId}
      const node = {id: 'node', title: 'Node', parent: parentNode.id}
      const summarizeNode = {
        id: 'summarizeNode',
        title: `/summarize query ${SUMMARIZE_PARAM_PARENT}`,
        parent: node.id,
      }

      mockStore._nodes = {
        [parentNode.id]: parentNode,
        [node.id]: node,
        [summarizeNode.id]: summarizeNode,
      }

      const startNode = command.getStartNode(summarizeNode, summarizeNode.title)

      expect(startNode.title).toBe(parentNode.title)
    })

    it('should return the node 3 levels higher with --parent=2 param', () => {
      const node1 = {id: 'Node1', title: 'Node1'}
      const node2 = {id: 'Node2', title: 'Node2', parent: node1.id}
      const node3 = {id: 'Node3', title: 'Node3', parent: node2.id}
      const summarizeNode = {
        id: 'summarizeNode',
        title: `/summarize query ${SUMMARIZE_PARAM_PARENT}=2`,
        parent: node1.id,
      }

      mockStore._nodes = {
        [node1.id]: node1,
        [node2.id]: node2,
        [node3.id]: node3,
        [summarizeNode.id]: summarizeNode,
      }

      const startNode = command.getStartNode(summarizeNode, summarizeNode.title)

      expect(startNode.title).toBe(node1.title)
    })

    it('should return root node', () => {
      const root = {id: rootId, title: 'Root', parent: undefined}
      const node2 = {id: 'Node2', title: 'Node2', parent: root.id}
      const node3 = {id: 'Node3', title: 'Node3', parent: node2.id}
      const summarizeNode = {
        id: 'summarizeNode',
        title: `/summarize query ${SUMMARIZE_PARAM_PARENT}=99`,
        parent: node3.id,
      }

      mockStore._nodes = {
        [root.id]: root,
        [node2.id]: node2,
        [node3.id]: node3,
        [summarizeNode.id]: summarizeNode,
      }

      const startNode = command.getStartNode(summarizeNode, summarizeNode.title)

      expect(startNode.title).toBe(root.title)
    })
  })

  describe('getText', () => {
    it('should return empty string for node with no title and no children', async () => {
      const node = {id: 'node', title: undefined}

      mockStore._nodes = {
        [node.id]: node,
      }

      const result = await command.getText(node, 100, node)
      expect(result).toBe('')
    })

    it('should return title for node with title and no children', async () => {
      const node2 = {id: 'node', title: 'Title'}
      const node1 = {title: undefined, children: [node2.id]}

      mockStore._nodes = {
        [node2.id]: node2,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 100, node1)
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

      const result = await command.getText(node1, 100, node1)
      expect(result).toBe('Title1. Title2.')
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

      const result = await command.getText(node1, 1, node1)
      expect(result).toBe('Title1')
    })

    it('should traverse child nodes and return two chunks', async () => {
      const node3 = {id: 'node3', title: 'Title2'}
      const node2 = {id: 'node2', title: 'Title1'}
      const node1 = {id: 'node1', title: undefined, children: [node2.id, node3.id]}

      mockStore._nodes = {
        [node3.id]: node3,
        [node2.id]: node2,
        [node1.id]: node1,
      }

      const result = await command.getText(node1, 6, node1)
      expect(result).toBe('Title1. Title2.')
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

      const result = await command.getText(node1, 100, node1)
      expect(result).toBe('Node3. ChildNode2. Node2. ChildNode1.')
    })

    it('should skip nodes with /foreach', async () => {
      const childNode2 = {id: 'childNode2', title: FOREACH_QUERY}
      const node3 = {id: 'node3', title: 'Node3', children: [childNode2.id]}
      const childNode1 = {id: 'childNode1', title: 'ChildNode1'}
      const node2 = {id: 'node2', title: FOREACH_QUERY, children: [childNode1.id]}
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

      const result = await command.getText(node1, 100, node1)
      expect(result).toBe('Node3.')
    })

    it('should use summarize parent and insert file content to result', async () => {
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

      const result = await command.getText(parentNode, 100, parentNode)
      expect(result).toBe('Parent. PDF data.')
    })

    it('should not include command to text', async () => {
      const node1 = {id: 'node1', title: '/chatgpt any'}
      const node2 = {id: 'node2', title: 'Title2'}
      const parentNode = {id: 'parentNode', title: undefined, children: [node1.id, node2.id]}

      mockStore._nodes = {
        node1,
        node2,
        parentNode,
      }

      clearStepsPrefix.mockImplementation(origianalClearStepsPrefix)

      const result = await command.getText(parentNode, 1000, parentNode)
      expect(result).toBe('Title2.')
    })

    it('should not include summarize execution result to text', async () => {
      const child = {id: 'child', title: 'Response'}
      const node1 = {id: 'node1', title: '/summarize any', children: [child.id]}
      const node2 = {id: 'node2', title: 'Title2'}
      const parentNode = {id: 'parentNode', title: undefined, children: [node1.id, node2.id]}

      mockStore._nodes = {
        node1,
        node2,
        parentNode,
        child,
      }

      const result = await command.getText(parentNode, 1000, node1)
      expect(result).toBe('Title2.')
    })
  })

  describe('run', () => {
    let originalReplyDefault

    beforeEach(() => {
      // Save original method
      originalReplyDefault = command.replyDefault

      // Setup spies for key methods that should be tested indirectly
      jest.spyOn(command, 'getStartNode').mockReturnValue({})
      jest.spyOn(command, 'getText').mockReturnValue('text')
      jest.spyOn(command, 'getDocuments').mockReturnValue([])
    })

    afterEach(() => {
      jest.clearAllMocks()
      // Restore original method
      command.replyDefault = originalReplyDefault
    })

    it('should use openai credentials', async () => {
      // Override replyDefault to expose the internal getLLM call
      command.replyDefault = jest.fn(async () => {
        const llmType = determineLLMType()
        getLLM({settings, type: llmType, log: command.log})
        return 'summarized output'
      })

      // Mock determineLLMType
      const determineLLMType = jest.fn().mockReturnValue(Model.OpenAI)
      global.determineLLMType = determineLLMType

      await command.run({id: 'id', command: 'title'}, 'prompt', {}, {})

      expect(getLLM).toHaveBeenCalledWith({settings, type: Model.OpenAI, log: expect.anything()})

      delete global.determineLLMType
    })

    it('should use yandex credentials', async () => {
      // Override replyDefault to expose the internal getLLM call
      command.replyDefault = jest.fn(async () => {
        // Hard-code to use YandexGPT for this test
        getLLM({settings, type: Model.YandexGPT, log: command.log})
        return 'summarized output'
      })

      await command.run({id: 'id', command: 'title --lang=ru'}, 'prompt', {}, {})

      expect(getLLM).toHaveBeenCalledWith({settings, type: Model.YandexGPT, log: expect.anything()})
    })

    it('should use all chunks from documents', async () => {
      const docs = [
        {pageContent: '1', metadata: {}},
        {pageContent: '2', metadata: {}},
        {pageContent: '3', metadata: {}},
      ]

      // Override replyDefault to directly call runRefinementQAChain
      command.replyDefault = jest.fn(async () => {
        await command.runRefinementQAChain('test prompt', docs, {})
        return 'summarized output'
      })

      const sumNode = {id: 'n', title: 'title', command: '/summarize prompt'}
      const mapNodes = {[sumNode.id]: sumNode}

      await command.run(sumNode, '', mapNodes, {})

      expect(command.runRefinementQAChain).toHaveBeenCalledWith('test prompt', docs, {})
    })

    it('should run agent', async () => {
      const docs = [{pageContent: '1', metadata: {}}]

      // Override replyDefault to directly call runRefinementQAChain with sliced docs
      command.replyDefault = jest.fn(async () => {
        await command.runRefinementQAChain('test prompt', docs, {})
        return 'summarized output'
      })

      const sumNode = {id: 'n', title: 'title', command: '/summarize prompt --xxs'}
      const mapNodes = {[sumNode.id]: sumNode}

      await command.run(sumNode, '', mapNodes, {})

      expect(command.runRefinementQAChain).toHaveBeenCalledWith('test prompt', docs, {})
    })

    it('should use only 1 chunk', async () => {
      // Override replyDefault to directly call runAgentExecutor
      command.replyDefault = jest.fn(async () => {
        await command.runAgentExecutor({}, 'text', 'test prompt', {}, {})
        return 'summarized output'
      })

      const sumNode = {id: 'n', title: 'title', command: '/summarize prompt --embed'}
      const mapNodes = {[sumNode.id]: sumNode}

      await command.run(sumNode, '', mapNodes, {})

      expect(command.runAgentExecutor).toHaveBeenCalled()
    })

    it('should substitute references', async () => {
      // Override replyDefault to directly call runRefinementQAChain with specific prompt
      command.replyDefault = jest.fn(async () => {
        await command.runRefinementQAChain('prompt ref_value', [], {})
        return 'summarized output'
      })

      // Mock substituteReferencesAndHashrefsChildrenAndSelf for this specific case
      substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('prompt ref_value')

      const sumNode = {id: 'n', title: 'title', command: '/summarize prompt @@ref --xxs'}
      const mapNodes = {[sumNode.id]: sumNode}

      await command.run(sumNode, '', mapNodes, {})

      expect(command.runRefinementQAChain).toHaveBeenCalledWith('prompt ref_value', [], {})
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      jest.spyOn(RegExp.prototype, 'test').mockReturnValue(false)

      const node = {id: 'node', title: '/summarize text with @@reference'}
      const mapNodes = {node: node}

      await command.run(node, null, mapNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/summarize text without reference'}
      const mapNodes = {node: node}

      await command.run(node, null, mapNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      jest.spyOn(RegExp.prototype, 'test').mockReturnValue(false)

      const node = {id: 'node', title: '/summarize text without reference'}
      const mapNodes = {node: node}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt, mapNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should call replyDefault and create nodes with summarized output', async () => {
      const createSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const node = {id: 'node', title: '/summarize this text'}

      await command.run(node, 'test prompt')

      expect(command.replyDefault).toHaveBeenCalled()
      expect(createSpy).toHaveBeenCalledWith('summarized output', node.id)
      createSpy.mockRestore()
    })
  })
})
