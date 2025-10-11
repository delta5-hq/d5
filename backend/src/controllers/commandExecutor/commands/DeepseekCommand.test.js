import {DeepseekCommand} from './DeepseekCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {ChatOpenAI} from 'langchain/chat_models/openai'
import {refRegExp} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import Store from './utils/Store'

jest.mock('./references/substitution')
jest.mock('./utils/langchain/getLLM')
jest.mock('langchain/chat_models/openai')

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

describe('DeepseekCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new DeepseekCommand(userId, workflowId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
    clearStepsPrefix.mockImplementation(str => `cleared ${str}`)
    getIntegrationSettings.mockResolvedValue({
      deepseek: {apiKey: 'apiKey', model: 'model'},
    })

    // Mock ChatOpenAI's call method
    ChatOpenAI.mockImplementation(() => ({
      call: jest.fn().mockResolvedValue({
        content: 'deepseek response',
      }),
    }))
  })

  describe('run', () => {
    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(true)

      const node = {id: 'node', title: '/deepseek prompt with @@reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/deepseek prompt without reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(false)

      const node = {id: 'node', title: '/deepseek prompt without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, null, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should create nodes with Deepseek response', async () => {
      const createSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const node = {id: 'node', title: '/deepseek prompt'}

      await command.run(node, null, 'test prompt')

      expect(createSpy).toHaveBeenCalledWith('deepseek response', node.id)
      createSpy.mockRestore()
    })
  })
})
