import {ChatCommand} from './ChatCommand'
import {BaseChatModel} from '@langchain/core/language_models/chat_models'

// Mock the reference patterns module
jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
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

import {clearStepsPrefix} from '../constants/steps'
import {referencePatterns} from './references/utils/referencePatterns'

import {getIntegrationSettings} from './utils/langchain/getLLM'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import Store from './utils/Store'

jest.mock('./utils/langchain/getLLM')
jest.mock('openai')
jest.mock('./references/substitution')

describe('ChatCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new ChatCommand(userId, workflowId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
  })

  const callSpy = jest.spyOn(BaseChatModel.prototype, 'invoke')

  beforeEach(() => {
    callSpy.mockClear()
  })

  describe('replyChatOpenAIAPI', () => {
    it('should return the content from OpenAI API response', async () => {
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: 'apiKey', model: 'model'},
      })
      callSpy.mockResolvedValue({
        content: 'Response',
      })

      const messages = [{content: 'prompt', role: 'user'}]
      const result = await command.replyChatOpenAIAPI(messages)

      expect(result).toBe('Response')
    })

    it('should propagate errors from LLM invocation', async () => {
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: 'apiKey', model: 'model'},
      })
      const testError = new Error('API rate limit exceeded')
      callSpy.mockRejectedValue(testError)

      const messages = [{content: 'prompt', role: 'user'}]

      await expect(command.replyChatOpenAIAPI(messages)).rejects.toThrow('API rate limit exceeded')
    })

    it('should propagate network errors from LLM', async () => {
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: 'apiKey', model: 'model'},
      })
      const networkError = new Error('ECONNREFUSED')
      callSpy.mockRejectedValue(networkError)

      const messages = [{content: 'prompt', role: 'user'}]

      await expect(command.replyChatOpenAIAPI(messages)).rejects.toThrow('ECONNREFUSED')
    })

    it('should propagate authentication errors from LLM', async () => {
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: 'invalid-key', model: 'model'},
      })
      const authError = new Error('Invalid API key')
      callSpy.mockRejectedValue(authError)

      const messages = [{content: 'prompt', role: 'user'}]

      await expect(command.replyChatOpenAIAPI(messages)).rejects.toThrow('Invalid API key')
    })
  })

  describe('run', () => {
    beforeEach(() => {
      command.store = mockStore

      mockStore.importer.createNodes = jest.fn()
      mockStore.importer.createTable = jest.fn()
      mockStore.importer.createJoinNode = jest.fn()
    })
    it('should create table nodes when readTableParam is true', async () => {
      callSpy.mockResolvedValue({
        content: 'Table',
      })
      const node = {id: 'node', command: '/chatgpt prompt --table'}

      await command.run(node, null, node.command)

      expect(mockStore.importer.createTable).toHaveBeenCalledWith('Table', node.id)
    })

    it('should create join nodes when readJoinParam is true', async () => {
      callSpy.mockResolvedValue({content: 'Join'})
      const node = {id: 'node', command: '/chatgpt prompt --join'}

      await command.run(node, null, node.command)

      expect(mockStore.importer.createJoinNode).toHaveBeenCalledWith('Join', node.id)
    })

    it('should create multiple nodes when neither table nor join params are true', async () => {
      callSpy.mockResolvedValue({content: 'Text'})
      const node = {id: 'node', command: '/chatgpt prompt'}

      await command.run(node, null, node.command)

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Text', node.id)
      expect(mockStore.importer.createJoinNode).not.toHaveBeenCalled()
      expect(mockStore.importer.createTable).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      callSpy.mockResolvedValue({content: 'Response'})
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)

      const node = {id: 'node', title: '/chatgpt prompt with @@reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      callSpy.mockResolvedValue({content: 'Response'})

      const node = {id: 'node', title: '/chatgpt prompt without reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      callSpy.mockResolvedValue({content: 'Response'})
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)

      const node = {id: 'node', title: '/chatgpt prompt without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, null, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    describe('error handling', () => {
      it('should create error node when LLM invocation fails', async () => {
        const testError = new Error('API connection timeout')
        callSpy.mockRejectedValue(testError)

        const node = {id: 'test-node', command: '/chatgpt test prompt'}

        await command.run(node, null, node.command)

        expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: API connection timeout', node.id)
      })

      it('should create error node when getIntegrationSettings fails', async () => {
        getIntegrationSettings.mockRejectedValue(new Error('Database connection lost'))

        const node = {id: 'test-node', command: '/chatgpt test prompt'}

        await command.run(node, null, node.command)

        expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: Database connection lost', node.id)
      })

      it('should create error node when prompt processing throws', async () => {
        substituteReferencesAndHashrefsChildrenAndSelf.mockImplementation(() => {
          throw new Error('Reference resolution failed')
        })

        const node = {id: 'test-node', command: '/chatgpt @@ref'}

        await command.run(node, null, null)

        expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: Reference resolution failed', node.id)
      })

      it('should log error details when execution fails', async () => {
        getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'key'}})
        const logErrorSpy = jest.spyOn(command, 'logError')
        const testError = new Error('Test error')
        callSpy.mockRejectedValue(testError)

        const node = {id: 'test-node', command: '/chatgpt test'}

        await command.run(node, null, node.command)

        expect(logErrorSpy).toHaveBeenCalledWith(testError)
      })

      it('should not create successful output nodes when error occurs', async () => {
        callSpy.mockRejectedValue(new Error('LLM failure'))

        const node = {id: 'test-node', command: '/chatgpt test --table'}

        await command.run(node, null, node.command)

        expect(mockStore.importer.createTable).not.toHaveBeenCalled()
        expect(mockStore.importer.createJoinNode).not.toHaveBeenCalled()
        expect(mockStore.importer.createNodes).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      })
    })
  })
})
