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

import {getIntegrationSettings, getLLM, Model} from './utils/langchain/getLLM'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import Store from './utils/Store'
import {ChatOpenAI} from '@langchain/openai'

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
    getLLM.mockReturnValue({llm: new ChatOpenAI({apiKey: 'test-key'})})
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

    it.each([
      ['rate-limit', 'API rate limit exceeded'],
      ['network', 'ECONNREFUSED'],
      ['authentication', 'Invalid API key'],
    ])('propagates %s error from LLM invocation unchanged', async (_label, message) => {
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'apiKey', model: 'model'}})
      callSpy.mockRejectedValue(new Error(message))

      await expect(command.replyChatOpenAIAPI([{content: 'prompt', role: 'user'}])).rejects.toThrow(message)
    })

    it('constructs LLM via getLLM with Model.OpenAI type', async () => {
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k', model: 'm'}})
      callSpy.mockResolvedValue({content: 'ok'})

      await command.replyChatOpenAIAPI([{role: 'user', content: 'hello'}])

      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({type: Model.OpenAI}))
      expect(getLLM).toHaveBeenCalledTimes(1)
    })

    it('maps system-role messages to SystemMessage and user-role messages to HumanMessage', async () => {
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
      callSpy.mockResolvedValue({content: 'ok'})

      await command.replyChatOpenAIAPI([
        {role: 'system', content: 'system context'},
        {role: 'user', content: 'user input'},
      ])

      const [[invokedMessages]] = callSpy.mock.calls
      expect(invokedMessages[0].constructor.name).toBe('SystemMessage')
      expect(invokedMessages[1].constructor.name).toBe('HumanMessage')
    })

    it('forwards resolved integration settings to getLLM as the settings argument', async () => {
      const settings = {openai: {apiKey: 'k', model: 'm'}}
      getIntegrationSettings.mockResolvedValue(settings)
      callSpy.mockResolvedValue({content: 'ok'})

      await command.replyChatOpenAIAPI([{role: 'user', content: 'hello'}])

      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({settings}))
    })

    it('forwards abort signal to the LLM invocation', async () => {
      const signal = new AbortController().signal
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k', model: 'm'}})
      callSpy.mockResolvedValue({content: 'ok'})

      await command.replyChatOpenAIAPI([{role: 'user', content: 'hello'}], {signal})

      expect(callSpy.mock.calls[0][1]?.signal).toBe(signal)
    })

    it('maps any non-system role (assistant, unknown) to HumanMessage', async () => {
      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k'}})
      callSpy.mockResolvedValue({content: 'ok'})

      await command.replyChatOpenAIAPI([
        {role: 'assistant', content: 'assistant turn'},
        {role: 'custom-role', content: 'unknown turn'},
      ])

      const [[invokedMessages]] = callSpy.mock.calls
      expect(invokedMessages[0].constructor.name).toBe('HumanMessage')
      expect(invokedMessages[1].constructor.name).toBe('HumanMessage')
    })
  })

  describe('run', () => {
    beforeEach(() => {
      command.store = mockStore

      mockStore.importer.createNodes = jest.fn()
      mockStore.importer.createTable = jest.fn()
      mockStore.importer.createJoinNode = jest.fn()
      mockStore.importer.createErrorNode = jest.fn()
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

        expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith('Error: API connection timeout', node.id)
      })

      it('should create error node when getIntegrationSettings fails', async () => {
        getIntegrationSettings.mockRejectedValue(new Error('Database connection lost'))

        const node = {id: 'test-node', command: '/chatgpt test prompt'}

        await command.run(node, null, node.command)

        expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith('Error: Database connection lost', node.id)
      })

      it('should create error node when prompt processing throws', async () => {
        substituteReferencesAndHashrefsChildrenAndSelf.mockImplementation(() => {
          throw new Error('Reference resolution failed')
        })

        const node = {id: 'test-node', command: '/chatgpt @@ref'}

        await command.run(node, null, null)

        expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith('Error: Reference resolution failed', node.id)
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
        expect(mockStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('Error:'), node.id)
      })
    })
  })

  describe('ChatOpenAI constructor arguments', () => {
    it('passes apiKey (not the deprecated openAIApiKey) to ChatOpenAI', async () => {
      const {ChatOpenAI} = jest.requireActual('@langchain/openai')
      const spy = jest.spyOn(ChatOpenAI.prototype, 'invoke').mockResolvedValue({content: 'ok'})

      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test-key', model: 'gpt-4o'}})

      const cmd = new ChatCommand('u', 'w', new Store({userId: 'u', nodes: {}}))
      await cmd.replyChatOpenAIAPI([{role: 'user', content: 'hi'}])

      expect(spy.mock.instances[0].apiKey).toBe('test-key')
      spy.mockRestore()
    })

    it('uses the user-configured model name', async () => {
      const {ChatOpenAI} = jest.requireActual('@langchain/openai')
      const spy = jest.spyOn(ChatOpenAI.prototype, 'invoke').mockResolvedValue({content: 'ok'})

      getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'k', model: 'gpt-4-turbo'}})

      const cmd = new ChatCommand('u', 'w', new Store({userId: 'u', nodes: {}}))
      await cmd.replyChatOpenAIAPI([{role: 'user', content: 'hi'}])

      expect(spy.mock.instances[0].model).toBe('gpt-4-turbo')
      spy.mockRestore()
    })

    it('throws when openai apiKey is absent from settings', async () => {
      getIntegrationSettings.mockResolvedValue({openai: {}})
      const cmd = new ChatCommand('u', 'w', new Store({userId: 'u', nodes: {}}))
      await expect(cmd.replyChatOpenAIAPI([{role: 'user', content: 'hi'}])).rejects.toThrow(
        'OpenAI API key not configured',
      )
    })

    it('throws when openai settings block is absent entirely', async () => {
      getIntegrationSettings.mockResolvedValue({claude: {apiKey: 'k'}})
      const cmd = new ChatCommand('u', 'w', new Store({userId: 'u', nodes: {}}))
      await expect(cmd.replyChatOpenAIAPI([{role: 'user', content: 'hi'}])).rejects.toThrow(
        'OpenAI API key not configured',
      )
    })

    it.each([
      ['an empty string', {apiKey: 'k', model: ''}],
      ['null', {apiKey: 'k', model: null}],
      ['undefined', {apiKey: 'k', model: undefined}],
      ['absent from the settings block', {apiKey: 'k'}],
    ])('resolves to gpt-4o when model is %s', async (_label, openaiSettings) => {
      const {ChatOpenAI} = jest.requireActual('@langchain/openai')
      const spy = jest.spyOn(ChatOpenAI.prototype, 'invoke').mockResolvedValue({content: 'ok'})

      getIntegrationSettings.mockResolvedValue({openai: openaiSettings})

      const cmd = new ChatCommand('u', 'w', new Store({userId: 'u', nodes: {}}))
      await cmd.replyChatOpenAIAPI([{role: 'user', content: 'hi'}])

      expect(spy.mock.instances[0].model).toBe('gpt-4o')
      spy.mockRestore()
    })
  })
})
