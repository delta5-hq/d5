import {LLMChain} from '@langchain/classic/chains'
import {OutlineCommand} from './OutlineCommand'
import {SummarizeCommand} from './SummarizeCommand'
import {getIntegrationSettings, getLLM, Model} from './utils/langchain/getLLM'
import {SUMMARIZE_SIZE_DEFAULT} from '../constants/outline'
import Integration from '../../../models/Integration'
import {RefineDocumentsChain} from '@langchain/classic/chains'
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
jest.mock('@langchain/classic/chains')
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
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new OutlineCommand(userId, workflowId, mockStore)
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

      const workflowNodes = {
        [command.id]: command,
      }

      const replyWithSummarizeSpy = jest.spyOn(command, 'replyWithSummarize')

      await command.run(node, 'prompt', workflowNodes, {})

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
      jest.spyOn(RefineDocumentsChain.prototype, 'invoke').mockReturnValue({output_text: 'response'})

      getLLM.mockImplementationOnce(() => {
        return {llm: {}, chunkSize: 2000}
      })

      const node = {
        id: 'node',
        command: '/outline prompt --web --lang=ru',
      }

      const workflowNodes = {
        [command.id]: command,
      }

      await command.run(node, 'prompt', workflowNodes, {})

      expect(getLLM).toHaveBeenCalledWith(
        expect.objectContaining({settings: expect.objectContaining(settings), type: Model.YandexGPT}),
      )
    })

    it('should use openai credentials', async () => {
      getIntegrationSettings.mockImplementation(sourceGetIntegrationSettings)
      jest.spyOn(Integration, 'findOne').mockReturnValue({
        lean: jest.fn().mockReturnValue(settings),
      })
      jest.spyOn(RefineDocumentsChain.prototype, 'invoke').mockReturnValue({output_text: 'response'})

      getLLM.mockImplementationOnce(() => {
        return {llm: {}, chunkSize: 2000}
      })

      const node = {
        id: 'node',
        command: '/outline prompt --web',
      }

      const workflowNodes = {
        [command.id]: command,
      }

      await command.run(node, 'prompt', workflowNodes, {})

      expect(getLLM).toHaveBeenCalledWith(
        expect.objectContaining({settings: expect.objectContaining(settings), type: Model.OpenAI}),
      )
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)
      jest.spyOn(command, 'replyDefault').mockResolvedValue([{id: 'newNode'}])

      const node = {id: 'node', title: '/outline create with @@reference'}
      const workflowNodes = {node: node}

      await command.run(node, null, workflowNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      jest.spyOn(command, 'replyDefault').mockResolvedValue([{id: 'newNode'}])

      const node = {id: 'node', title: '/outline create without reference'}
      const workflowNodes = {node: node}

      await command.run(node, null, workflowNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)
      jest.spyOn(command, 'replyDefault').mockResolvedValue([{id: 'newNode'}])

      const node = {id: 'node', title: '/outline create without reference'}
      const workflowNodes = {node: node}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt, workflowNodes)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })
  })

  describe('abort signal support', () => {
    it('passes signal through params to createResponseOutline', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.replyDefault = jest.fn().mockResolvedValue(undefined)

      const abortController = new AbortController()
      const node = {id: 'node', command: '/outline test'}

      await command.run(node, 'prompt', {signal: abortController.signal})

      expect(command.replyDefault).toHaveBeenCalledWith(
        node,
        expect.any(String),
        expect.objectContaining({
          signal: abortController.signal,
        }),
      )
    })

    it('accepts run with no options parameter for backward compatibility', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.replyDefault = jest.fn().mockResolvedValue(undefined)

      const node = {id: 'node', command: '/outline test'}

      await expect(command.run(node, 'prompt')).resolves.not.toThrow()
      expect(command.replyDefault).toHaveBeenCalled()
    })

    it('accepts run with undefined signal for backward compatibility', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.replyDefault = jest.fn().mockResolvedValue(undefined)

      const node = {id: 'node', command: '/outline test'}

      await expect(command.run(node, 'prompt', {signal: undefined})).resolves.not.toThrow()
      expect(command.replyDefault).toHaveBeenCalled()
    })

    it('propagates signal to all execution paths', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.replyWithSummarize = jest.fn().mockResolvedValue(undefined)
      command.replySecondDebugLevelOutline = jest.fn().mockResolvedValue(undefined)
      command.replySecondLevelsOutline = jest.fn().mockResolvedValue(undefined)

      const abortController = new AbortController()
      const signal = abortController.signal

      const summarizeNode = {id: 'n1', command: '/outline test --summarize'}
      await command.run(summarizeNode, 'p', {signal})
      expect(command.replyWithSummarize).toHaveBeenCalledWith(
        summarizeNode,
        expect.anything(),
        expect.any(String),
        expect.objectContaining({signal}),
      )

      const debugNode = {id: 'n2', command: '/outline test --debuglevel=2'}
      await command.run(debugNode, 'p', {signal})
      expect(command.replySecondDebugLevelOutline).toHaveBeenCalledWith(debugNode, expect.objectContaining({signal}))

      const levelsNode = {id: 'n3', command: '/outline test --levels=2'}
      await command.run(levelsNode, 'p', {signal})
      expect(command.replySecondLevelsOutline).toHaveBeenCalledWith(
        levelsNode,
        expect.any(String),
        expect.objectContaining({signal}),
      )
    })
  })

  describe('command resolution (title-only nodes)', () => {
    beforeEach(() => {
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test-key'}})
      getLLM.mockReturnValue({llm: {}, chunkSize: 1000})
      jest.clearAllMocks()
    })

    it('runs successfully with title-only node containing :lang param', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.createResponseOutline = jest.fn().mockResolvedValue('outline result')

      const node = {id: 'node', title: '/outline create :lang=ru'}

      await expect(command.run(node, 'test prompt')).resolves.not.toThrow()
      expect(command.createResponseOutline).toHaveBeenCalledWith(node, expect.anything(), expect.anything())
    })

    it('runs successfully with title-only node without params', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.createResponseOutline = jest.fn().mockResolvedValue('outline result')

      const node = {id: 'node', title: '/outline create'}

      await expect(command.run(node, 'test prompt')).resolves.not.toThrow()
      expect(command.createResponseOutline).toHaveBeenCalledWith(node, expect.anything(), expect.anything())
    })

    it('runs successfully with title-only --summarize node', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.replyWithSummarize = jest.fn().mockResolvedValue(undefined)

      const node = {id: 'node', title: '/outline test --summarize :lang=yandex'}

      await expect(command.run(node, 'test prompt')).resolves.not.toThrow()
      expect(command.replyWithSummarize).toHaveBeenCalled()
    })

    it('prefers command over title when both populated', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      const createSpy = jest.spyOn(command, 'createResponseOutline').mockResolvedValue('result')

      const node = {
        id: 'node',
        command: '/outline from-command :lang=openai',
        title: '/outline from-title :lang=yandex',
      }

      await command.run(node, 'test prompt')

      expect(createSpy).toHaveBeenCalled()
    })

    it('handles empty command and empty title gracefully', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.replyDefault = jest.fn().mockResolvedValue(undefined)

      const node = {id: 'node', command: '', title: ''}

      await expect(command.run(node, 'test prompt')).resolves.not.toThrow()
    })

    it('falls back to title when command is undefined', async () => {
      const command = new OutlineCommand('user-id', null, mockStore)
      command.replyDefault = jest.fn().mockResolvedValue(undefined)

      const node = {id: 'node', title: '/outline fallback-title'}

      await expect(command.run(node, 'test prompt')).resolves.not.toThrow()
      expect(command.replyDefault).toHaveBeenCalled()
    })
  })
})
