import {CustomLLMChatCommand} from './CustomLLMChatCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {CustomLLMChat} from './utils/langchain/CustomLLMChat'
import {clearStepsPrefix} from '../constants/steps'
import Store from './utils/Store'

jest.mock('./references/substitution')
jest.mock('./utils/langchain/getLLM')
jest.mock('./utils/langchain/CustomLLMChat', () => ({
  CustomLLMChat: jest.fn().mockImplementation(() => ({invoke: jest.fn()})),
}))
jest.mock('../constants/steps', () => ({
  clearStepsPrefix: jest.fn(str => `cleared ${str}`),
}))

describe('CustomLLMChatCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({userId, workflowId, nodes: {}})
  const command = new CustomLLMChatCommand(userId, workflowId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
    clearStepsPrefix.mockImplementation(str => `cleared ${str}`)
    getIntegrationSettings.mockResolvedValue({
      custom_llm: {apiRootUrl: 'http://localhost:8080', apiKey: 'key', apiType: 'openai'},
    })
    CustomLLMChat.mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({content: 'custom llm response'}),
    }))
  })

  describe('run', () => {
    it('creates nodes with the LLM response', async () => {
      const createSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const node = {id: 'node', title: '/custom test'}

      await command.run(node, null, 'test prompt')

      expect(createSpy).toHaveBeenCalledWith('custom llm response', node.id)
      createSpy.mockRestore()
    })

    it('uses substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/custom test'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('uses clearStepsPrefix when prompt is provided and title has no reference', async () => {
      const node = {id: 'node', title: '/custom test'}

      await command.run(node, null, 'original prompt')

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith('original prompt')
    })
  })

  describe('CustomLLMChat constructor arguments', () => {
    const node = {id: 'node', title: '/custom test'}

    beforeEach(async () => {
      await command.run(node, null, 'test prompt')
    })

    it('passes apiRootUrl from settings', () => {
      expect(CustomLLMChat).toHaveBeenCalledWith(expect.objectContaining({apiRootUrl: 'http://localhost:8080'}))
    })

    it('passes apiKey from settings', () => {
      expect(CustomLLMChat).toHaveBeenCalledWith(expect.objectContaining({apiKey: 'key'}))
    })

    it('passes apiType from settings', () => {
      expect(CustomLLMChat).toHaveBeenCalledWith(expect.objectContaining({apiType: 'openai'}))
    })
  })

  describe('error handling', () => {
    it('creates error node when custom_llm settings block is absent entirely', async () => {
      getIntegrationSettings.mockResolvedValueOnce({openai: {apiKey: 'k'}})
      const createSpy = jest.spyOn(mockStore.importer, 'createErrorNode')
      const node = {id: 'node', title: '/custom test'}

      await command.run(node, null, 'test')

      expect(createSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      createSpy.mockRestore()
    })

    it('creates error node when custom_llm.apiRootUrl is absent', async () => {
      getIntegrationSettings.mockResolvedValueOnce({custom_llm: {apiKey: 'key'}})
      const createSpy = jest.spyOn(mockStore.importer, 'createErrorNode')
      const node = {id: 'node', title: '/custom test'}

      await command.run(node, null, 'test')

      expect(createSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      createSpy.mockRestore()
    })

    it('creates error node when settings resolves to null', async () => {
      getIntegrationSettings.mockResolvedValueOnce(null)
      const createSpy = jest.spyOn(mockStore.importer, 'createErrorNode')
      const node = {id: 'node', title: '/custom test'}

      await command.run(node, null, 'test')

      expect(createSpy).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      createSpy.mockRestore()
    })

    it('error message mentions configuration when apiRootUrl is absent', async () => {
      getIntegrationSettings.mockResolvedValueOnce({custom_llm: {}})
      const createSpy = jest.spyOn(mockStore.importer, 'createErrorNode')
      const node = {id: 'node', title: '/custom test'}

      await command.run(node, null, 'test')

      const [errorArg] = createSpy.mock.calls[0]
      expect(errorArg).toMatch(/[Cc]onfigur/)
      createSpy.mockRestore()
    })
  })
})
