import {ChatCommand} from '../ChatCommand'
import {ClaudeCommand} from '../ClaudeCommand'
import {YandexCommand} from '../YandexCommand'
import {DeepseekCommand} from '../DeepseekCommand'
import {QwenCommand} from '../QwenCommand'
import {PerplexityCommand} from '../PerplexityCommand'
import {CustomLLMChatCommand} from '../CustomLLMChatCommand'
import {SwitchCommand} from '../SwitchCommand'
import {BaseChatModel} from '@langchain/core/language_models/chat_models'
import {ClaudeService} from '../../../integrations/claude/ClaudeService'
import YandexService from '../../../integrations/yandex/YandexService'
import Store from '../utils/Store'

jest.mock('../utils/langchain/getLLM')
jest.mock('../../../integrations/claude/ClaudeService')
jest.mock('../../../integrations/yandex/YandexService')
jest.mock('openai')
jest.mock('../references/substitution')
jest.mock('../references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({test: jest.fn(() => false)})),
  },
}))
jest.mock('../../constants/steps', () => ({
  clearStepsPrefix: jest.fn(str => str),
}))
jest.mock('../../constants', () => {
  const originalModule = jest.requireActual('../../constants')
  return {
    ...originalModule,
    clearCommandsWithParams: jest.fn(str => str),
  }
})
jest.mock('../references/utils/referenceUtils', () => ({
  clearReferences: jest.fn(str => str),
}))
jest.mock('../utils/createContextForChat', () => ({
  createContextForChat: jest.fn(() => ''),
}))

describe('Command Error Propagation (Generalized)', () => {
  const userId = 'test-user'
  const workflowId = 'test-workflow'
  let mockStore

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore = new Store({
      userId,
      workflowId,
      nodes: {},
    })
    mockStore.importer = {
      createNodes: jest.fn(),
      createTable: jest.fn(),
      createJoinNode: jest.fn(),
    }
  })

  describe('Network Error Propagation', () => {
    const networkErrors = [
      {name: 'ECONNREFUSED', message: 'Connection refused'},
      {name: 'ETIMEDOUT', message: 'Connection timeout'},
      {name: 'ENOTFOUND', message: 'DNS lookup failed'},
      {name: 'ECONNRESET', message: 'Connection reset by peer'},
    ]

    networkErrors.forEach(({name, message}) => {
      it(`should propagate ${name} network error from ChatCommand`, async () => {
        const {getIntegrationSettings} = require('../utils/langchain/getLLM')
        getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'key', model: 'model'}})

        const spy = jest.spyOn(BaseChatModel.prototype, 'invoke')
        const error = new Error(message)
        error.code = name
        spy.mockRejectedValue(error)

        const command = new ChatCommand(userId, workflowId, mockStore)
        const node = {id: 'node1', command: '/chatgpt test'}

        await expect(command.run(node, null, 'test prompt')).rejects.toThrow(message)
        spy.mockRestore()
      })
    })
  })

  describe('API Error Propagation', () => {
    const apiErrors = [
      {status: 401, message: 'Invalid API key'},
      {status: 403, message: 'Insufficient permissions'},
      {status: 429, message: 'Rate limit exceeded'},
      {status: 500, message: 'Internal server error'},
      {status: 503, message: 'Service unavailable'},
    ]

    apiErrors.forEach(({status, message}) => {
      it(`should propagate HTTP ${status} error from ClaudeCommand`, async () => {
        const {getIntegrationSettings} = require('../utils/langchain/getLLM')
        getIntegrationSettings.mockResolvedValue({
          claude: {apiKey: 'key', model: 'model'},
        })

        const error = new Error(message)
        error.status = status
        ClaudeService.sendMessages.mockRejectedValue(error)

        const command = new ClaudeCommand(userId, workflowId, mockStore)
        const node = {id: 'node1', command: '/claude test'}

        await expect(command.run(node, null, 'test prompt')).rejects.toThrow(message)
      })
    })
  })

  describe('Timeout Error Propagation', () => {
    it('should propagate timeout errors from YandexCommand', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        yandex: {apiKey: 'key', folder_id: 'folder', model: 'model'},
      })

      const timeoutError = new Error('Request timeout after 30000ms')
      timeoutError.name = 'TimeoutError'
      YandexService.completionWithRetry.mockRejectedValue(timeoutError)

      const command = new YandexCommand(userId, workflowId, mockStore)
      const node = {id: 'node1', command: '/yandexgpt test'}

      await expect(command.run(node, null, 'test prompt')).rejects.toThrow('Request timeout')
    })

    it('should propagate timeout errors from DeepseekCommand', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        deepseek: {apiKey: 'key', model: 'model'},
      })

      const spy = jest.spyOn(BaseChatModel.prototype, 'invoke')
      const timeoutError = new Error('Timeout waiting for response')
      spy.mockRejectedValue(timeoutError)

      const command = new DeepseekCommand(userId, workflowId, mockStore)
      const node = {id: 'node1', command: '/deepseek test'}

      await expect(command.run(node, null, 'test prompt')).rejects.toThrow('Timeout waiting for response')
      spy.mockRestore()
    })
  })

  describe('Malformed Response Error Propagation', () => {
    it('should propagate JSON parse errors from API responses', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        qwen: {apiKey: 'key', model: 'model'},
      })

      const parseError = new Error('Unexpected token in JSON at position 0')
      parseError.name = 'SyntaxError'

      const command = new QwenCommand(userId, workflowId, mockStore)
      jest.spyOn(command, 'replyQwen').mockRejectedValue(parseError)

      const node = {id: 'node1', command: '/qwen test'}

      await expect(command.run(node, null, 'test prompt')).rejects.toThrow('Unexpected token in JSON')
    })
  })

  describe('Model-Specific Error Propagation', () => {
    it('should propagate model overload errors', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        perplexity: {apiKey: 'key', model: 'model'},
      })

      const command = new PerplexityCommand(userId, workflowId, mockStore)
      const overloadError = new Error('Model is currently overloaded')
      jest.spyOn(command, 'reply').mockRejectedValue(overloadError)

      const node = {id: 'node1', command: '/perplexity test'}

      await expect(command.run(node, null, 'test prompt')).rejects.toThrow('Model is currently overloaded')
    })

    it('should propagate content policy violation errors', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        custom_llm: {apiRootUrl: 'http://localhost', apiType: 'openai', apiKey: 'key'},
      })

      const spy = jest.spyOn(BaseChatModel.prototype, 'invoke')
      const policyError = new Error('Content policy violation')
      policyError.code = 'content_filter'
      spy.mockRejectedValue(policyError)

      const command = new CustomLLMChatCommand(userId, workflowId, mockStore)
      const node = {id: 'node1', command: '/custom test'}

      await expect(command.run(node, null, 'test prompt')).rejects.toThrow('Content policy violation')
      spy.mockRestore()
    })
  })

  describe('Integration Settings Error Propagation', () => {
    it('should propagate missing integration settings errors', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({})

      const command = new ChatCommand(userId, workflowId, mockStore)
      const node = {id: 'node1', command: '/chatgpt test'}

      await expect(command.run(node, null, 'test prompt')).rejects.toThrow()
    })

    it('should propagate invalid API key format errors', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: '', model: 'model'},
      })

      const command = new ChatCommand(userId, workflowId, mockStore)
      const node = {id: 'node1', command: '/chatgpt test'}

      await expect(command.run(node, null, 'test prompt')).rejects.toThrow(
        'OpenAI API key not configured. Set it in Integration Settings or set the OPENAI_API_KEY environment variable.',
      )
    })
  })

  describe('Switch Command Error Propagation', () => {
    it('should propagate errors from switch LLM evaluation', async () => {
      const command = new SwitchCommand(userId, workflowId, mockStore)
      const mockLLM = {
        invoke: jest.fn().mockRejectedValue(new Error('Failed to evaluate switch condition')),
      }

      await expect(command.executeSwitch('test', 'system prompt', mockLLM)).rejects.toThrow(
        'Failed to evaluate switch condition',
      )
    })
  })

  describe('Error Message Preservation', () => {
    it('should preserve original error stack traces', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: 'key', model: 'model'},
      })

      const spy = jest.spyOn(BaseChatModel.prototype, 'invoke')
      const originalError = new Error('Original error message')
      originalError.stack = 'Error: Original error message\n    at test.js:10:5'
      spy.mockRejectedValue(originalError)

      const command = new ChatCommand(userId, workflowId, mockStore)
      const node = {id: 'node1', command: '/chatgpt test'}

      await expect(async () => {
        await command.run(node, null, 'test prompt')
      }).rejects.toMatchObject({
        message: 'Original error message',
        stack: expect.stringContaining('at test.js:10:5'),
      })
      spy.mockRestore()
    })
  })

  describe('Concurrent Error Handling', () => {
    it('should handle errors when multiple commands fail simultaneously', async () => {
      const {getIntegrationSettings} = require('../utils/langchain/getLLM')
      getIntegrationSettings.mockResolvedValue({
        openai: {apiKey: 'key', model: 'model'},
      })

      const spy = jest.spyOn(BaseChatModel.prototype, 'invoke')
      spy.mockRejectedValue(new Error('Concurrent failure'))

      const command1 = new ChatCommand(userId, workflowId, mockStore)
      const command2 = new ChatCommand(userId, workflowId, mockStore)

      const node1 = {id: 'node1', command: '/chatgpt test1'}
      const node2 = {id: 'node2', command: '/chatgpt test2'}

      const results = await Promise.allSettled([command1.run(node1, null, 'test1'), command2.run(node2, null, 'test2')])

      expect(results[0].status).toBe('rejected')
      expect(results[1].status).toBe('rejected')
      expect(results[0].reason.message).toBe('Concurrent failure')
      expect(results[1].reason.message).toBe('Concurrent failure')
      spy.mockRestore()
    })
  })
})
