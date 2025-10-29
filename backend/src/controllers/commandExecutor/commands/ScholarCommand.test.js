import {ScholarCommand} from './ScholarCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings, getLLM, getEmbeddings} from './utils/langchain/getLLM'
import {createSimpleAgentExecutor} from './utils/langchain/getAgentExecutor'
import {conditionallyTranslate} from './utils/translate'

// Mock the reference patterns module
jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
}))

// Mock the entire constants module before importing actual constants
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

jest.mock('./references/substitution')
jest.mock('./utils/langchain/getLLM')
jest.mock('./utils/langchain/getAgentExecutor')
jest.mock('./utils/translate')

describe('ScholarCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new ScholarCommand(userId, workflowId, mockStore)

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

    jest.spyOn(command, 'createResponseScholar').mockResolvedValue('scholar response')
  })

  describe('run', () => {
    beforeEach(() => {
      command.store = mockStore

      mockStore.importer.createNodes = jest.fn()
      mockStore.importer.createTable = jest.fn()
      mockStore.importer.createJoinNode = jest.fn()
    })
    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)

      const node = {id: 'node', title: '/scholar search with @@reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/scholar search without reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)

      const node = {id: 'node', title: '/scholar search without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should call createResponseScholar and create nodes with response', async () => {
      const node = {id: 'node', title: '/scholar search term'}

      await command.run(node, 'test prompt')

      expect(command.createResponseScholar).toHaveBeenCalled()
      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('scholar response', node.id)
    })
  })
})
