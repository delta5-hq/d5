import {getIntegrationSettings, getLLM, Model, getEmbeddings} from './utils/langchain/getLLM'
import Integration from '../../../models/Integration'
import {RefineDocumentsChain} from 'langchain/chains'

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

import {refRegExp} from '../constants'
import {clearStepsPrefix} from '../constants/steps'

import {WebCommand} from './WebCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {createSimpleAgentExecutor} from './utils/langchain/getAgentExecutor'
import {conditionallyTranslate} from './utils/translate'
import Store from './utils/Store'

jest.mock('langchain')
jest.mock('./utils/langchain/getLLM', () => ({
  ...jest.requireActual('./utils/langchain/getLLM'),
  getLLM: jest.fn(),
  getIntegrationSettings: jest.fn(),
  getEmbeddings: jest.fn(),
}))
jest.mock('./references/substitution')
jest.mock('./utils/langchain/getAgentExecutor')
jest.mock('./utils/translate')
jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
}))

const sourceGetIntegrationSettings = jest.requireActual('./utils/langchain/getLLM').getIntegrationSettings

describe('WebCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new WebCommand(userId, workflowId, mockStore)
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
    getIntegrationSettings.mockResolvedValue({
      openai: {apiKey: 'apiKey', model: 'model'},
    })
    getLLM.mockReturnValue({llm: {}, chunkSize: 2000})
    getEmbeddings.mockReturnValue({})
    createSimpleAgentExecutor.mockReturnValue({
      call: jest.fn().mockResolvedValue({output: 'agent output'}),
    })
    conditionallyTranslate.mockResolvedValue('translated output')
  })

  afterEach(() => {
    getIntegrationSettings.mockImplementation(() => jest.fn())
    jest.clearAllMocks()
  })

  describe('run', () => {
    beforeEach(() => {
      command.store = mockStore

      mockStore.importer.createNodes = jest.fn()
      mockStore.importer.createTable = jest.fn()
      mockStore.importer.createJoinNode = jest.fn()
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
        command: '/web prompt --lang=ru',
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
        command: '/web prompt',
      }

      await command.run(node, 'prompt')

      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({settings, type: Model.OpenAI}))
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(true)

      const node = {id: 'node', title: '/web search with @@reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/web search without reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(false)

      const node = {id: 'node', title: '/web search without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should create and return nodes using createNodes', async () => {
      const node = {id: 'node', title: '/web search term'}

      await command.run(node, 'test prompt', {})

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('translated output', node.id)
    })
  })
})
