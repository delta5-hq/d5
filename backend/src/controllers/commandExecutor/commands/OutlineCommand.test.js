import {LLMChain} from 'langchain'
import {OutlineCommand} from './OutlineCommand'
import {SummarizeCommand} from './SummarizeCommand'
import {getIntegrationSettings, getLLM, Model} from './utils/langchain/getLLM'
import {SUMMARIZE_SIZE_DEFAULT} from '../constants/outline'
import Integration from '../../../models/Integration'
import {RefineDocumentsChain} from 'langchain/chains'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'

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

// Now import the constants after mocking
import {clearStepsPrefix} from '../constants/steps'
import {referencePatterns} from './references/utils/referencePatterns'
import Store from './utils/Store'

// jest.mock('./SummarizeCommand')
jest.mock('langchain')
jest.mock('./utils/langchain/getLLM', () => ({
  ...jest.requireActual('./utils/langchain/getLLM'),
  getLLM: jest.fn(),
  getIntegrationSettings: jest.fn(),
}))
jest.mock('./references/substitution')
jest.mock('./utils/translate')

const sourceGetIntegrationSettings = jest.requireActual('./utils/langchain/getLLM').getIntegrationSettings

describe('OutlineCommand', () => {
  const userId = 'userId'
  const mapId = 'mapId'
  const mockStore = new Store({
    userId,
    mapId,
    nodes: {},
  })
  const command = new OutlineCommand(userId, mapId, mockStore)
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
  })

  afterEach(() => {
    getIntegrationSettings.mockImplementation(() => jest.fn())
    jest.clearAllMocks()
  })

  describe('replyWithSummarize', () => {
    it('should run agent executor when summarize chunks specified', async () => {
      const text = 'Text'
      SummarizeCommand.prototype.getText = jest.fn().mockResolvedValue(text)
      SummarizeCommand.prototype.runAgentExecutor = jest.fn().mockResolvedValue('')
      SummarizeCommand.prototype.calculateMaxChunksFromSize = jest.fn().mockResolvedValue(2)

      getIntegrationSettings.mockResolvedValue(settings)
      getLLM.mockResolvedValue({llm: jest.fn(), chunkSize: 10})

      const node1 = {id: 'node1', command: '/outline prompt --embed', title: 'node1'}
      const node2 = {id: 'node2', title: 'node2'}
      const parent = {id: 'parent', title: 'parent', children: [node1.id, node2.id]}
      SummarizeCommand.prototype.getStartNode = jest.fn().mockResolvedValue(parent)

      const params = {
        sizeLabel: 'xxl',
      }
      const allNodes = {}
      const prompt = 'prompt'

      LLMChain.prototype.run = jest.fn().mockResolvedValue('NewNode1\n\nNewNode2')

      await command.replyWithSummarize(node1, node1.command, prompt, allNodes, {}, params)

      // expect(result).toHaveLength(2)
      expect(SummarizeCommand.prototype.runAgentExecutor).toHaveBeenCalled()
    })

    it('should run refinement qa chain when summarize chunk size is default', async () => {
      const text = 'Text'
      SummarizeCommand.prototype.getText = jest.fn().mockResolvedValue(text)
      SummarizeCommand.prototype.getDocuments = jest.fn().mockResolvedValue([{}, {}])
      SummarizeCommand.prototype.runRefinementQAChain = jest.fn().mockResolvedValue('')
      SummarizeCommand.prototype.calculateMaxChunksFromSize = jest.fn().mockResolvedValue(2)

      getIntegrationSettings.mockResolvedValue(settings)
      getLLM.mockResolvedValue({llm: jest.fn(), chunkSize: 10})

      const node1 = {id: 'node1', command: '/outline prompt --summarize', title: 'node1'}
      const node2 = {id: 'node2', title: 'node2'}
      const parent = {id: 'parent', title: 'parent', children: [node1.id, node2.id]}
      SummarizeCommand.prototype.getStartNode = jest.fn().mockResolvedValue(parent)

      const params = {
        summarizeSize: SUMMARIZE_SIZE_DEFAULT,
      }
      const allNodes = {}
      const prompt = 'prompt'

      LLMChain.prototype.run = jest.fn().mockResolvedValue('NewNode1\n\nNewNode2')

      await command.replyWithSummarize(node1, node1.command, prompt, allNodes, {}, params)

      expect(SummarizeCommand.prototype.runRefinementQAChain).toHaveBeenCalled()
    })

    it('should run refinement qa chain when summarize chunk size is default', async () => {
      const createNodesSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const node1 = {id: 'node1', command: '/outline prompt --summarize', title: 'node1'}

      const params = {
        summarizeSize: SUMMARIZE_SIZE_DEFAULT,
      }
      const allNodes = {}
      const prompt = 'prompt'

      const output = `[
        ["Fruits", ["Citrus", "Berries", "Tropical"],
        ["Citrus", []],
        ["Berries", []],
        ["Tropical", []],
      ]`

      jest.spyOn(SummarizeCommand.prototype, 'replyDefault').mockResolvedValue(output)

      await command.replyWithSummarize(node1, node1.command, prompt, allNodes, {}, params)

      expect(createNodesSpy).toHaveBeenCalledWith('Fruits\n  Citrus\n  Berries\n  Tropical\n', expect.anything())
      createNodesSpy.mockRestore()
    })
  })

  describe('run', () => {
    it('should call replyWithSummarize with source command', async () => {
      const node = {
        id: 'node',
        command: '/outline prompt --summarize --parent=2',
      }

      const mapNodes = {
        [command.id]: command,
      }

      const replyWithSummarizeSpy = jest.spyOn(command, 'replyWithSummarize')

      await command.run(node, 'prompt', mapNodes, {})

      expect(replyWithSummarizeSpy).toHaveBeenCalledWith(
        expect.anything(),
        node.command,
        expect.anything(),
        expect.anything(),
      )
    })

    it('should use yandex credentials', async () => {
      getIntegrationSettings.mockImplementation(sourceGetIntegrationSettings)
      jest.spyOn(Integration, 'findOne').mockReturnValue({
        lean: jest.fn().mockReturnValue(settings),
      })
      jest.spyOn(RefineDocumentsChain.prototype, 'call').mockReturnValue({output_text: 'response'})

      getLLM.mockImplementationOnce(() => {
        return {llm: {}, chunkSize: 2000}
      })

      const node = {
        id: 'node',
        command: '/outline prompt --web --lang=ru',
      }

      const mapNodes = {
        [command.id]: command,
      }

      await command.run(node, 'prompt', mapNodes, {})

      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({settings, type: Model.YandexGPT}))
    })

    it('should use openai credentials', async () => {
      getIntegrationSettings.mockImplementation(sourceGetIntegrationSettings)
      jest.spyOn(Integration, 'findOne').mockReturnValue({
        lean: jest.fn().mockReturnValue(settings),
      })
      jest.spyOn(RefineDocumentsChain.prototype, 'call').mockReturnValue({output_text: 'response'})

      getLLM.mockImplementationOnce(() => {
        return {llm: {}, chunkSize: 2000}
      })

      const node = {
        id: 'node',
        command: '/outline prompt --web',
      }

      const mapNodes = {
        [command.id]: command,
      }

      await command.run(node, 'prompt', mapNodes, {})

      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({settings, type: Model.OpenAI}))
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)
      jest.spyOn(command, 'replyDefault').mockResolvedValue([{id: 'newNode'}])

      const node = {id: 'node', title: '/outline create with @@reference'}
      const mapNodes = {node: node}

      await command.run(node, null, mapNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      jest.spyOn(command, 'replyDefault').mockResolvedValue([{id: 'newNode'}])

      const node = {id: 'node', title: '/outline create without reference'}
      const mapNodes = {node: node}

      await command.run(node, null, mapNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)
      jest.spyOn(command, 'replyDefault').mockResolvedValue([{id: 'newNode'}])

      const node = {id: 'node', title: '/outline create without reference'}
      const mapNodes = {node: node}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt, mapNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })
  })
})
