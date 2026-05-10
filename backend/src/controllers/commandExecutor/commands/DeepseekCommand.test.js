import {DeepseekCommand} from './DeepseekCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {ChatOpenAI} from '@langchain/openai'
import {refRegExp} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import Store from './utils/Store'

jest.mock('./references/substitution')
jest.mock('./utils/langchain/getLLM')
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({invoke: jest.fn()})),
  OpenAIEmbeddings: jest.fn(),
}))

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

    ChatOpenAI.mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({
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

  describe('ChatOpenAI constructor arguments', () => {
    const node = {id: 'node', title: '/deepseek test'}

    beforeEach(async () => {
      await command.run(node, null, 'test prompt')
    })

    it('passes apiKey (not the deprecated openAIApiKey) to ChatOpenAI', () => {
      expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({apiKey: 'apiKey'}))
    })

    it('does not pass deprecated openAIApiKey', () => {
      expect(ChatOpenAI).not.toHaveBeenCalledWith(expect.objectContaining({openAIApiKey: expect.anything()}))
    })

    it('passes model from settings', () => {
      expect(ChatOpenAI).toHaveBeenCalledWith(expect.objectContaining({model: 'model'}))
    })

    it('passes Deepseek baseURL in configuration', () => {
      expect(ChatOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({baseURL: 'https://api.deepseek.com'}),
        }),
      )
    })

    it('does not pass deprecated basePath in configuration', () => {
      const call = ChatOpenAI.mock.calls[0][0]
      expect(call.configuration).not.toHaveProperty('basePath')
    })
  })

  describe('error handling', () => {
    it('creates error node when deepseek apiKey is absent from settings', async () => {
      getIntegrationSettings.mockResolvedValueOnce({deepseek: {}})
      const createSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const cmd = new DeepseekCommand('u', 'w', mockStore)
      const node = {id: 'node', title: '/deepseek test'}
      await cmd.run(node, null, 'test')
      expect(createSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      createSpy.mockRestore()
    })

    it('creates error node when deepseek settings block is absent entirely', async () => {
      getIntegrationSettings.mockResolvedValueOnce({openai: {apiKey: 'k'}})
      const createSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const cmd = new DeepseekCommand('u', 'w', mockStore)
      const node = {id: 'node', title: '/deepseek test'}
      await cmd.run(node, null, 'test')
      expect(createSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      createSpy.mockRestore()
    })
  })
})
