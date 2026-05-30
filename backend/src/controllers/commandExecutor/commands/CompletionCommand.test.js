import {CompletionCommand} from './CompletionCommand'
import {USER_DEFAULT_MODEL} from '../../../shared/config/constants'
import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {QWEN_QUERY_TYPE} from '../constants/qwen'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'
import {Model} from './utils/langchain/getLLM'

import {getIntegrationSettings} from './utils/langchain/getLLM'
import {runCommand} from './utils/runCommand'

jest.mock('./utils/langchain/getLLM')
jest.mock('./utils/runCommand')

const mockCell = {id: 'cell1'}
const mockNodes = {}
const mockFiles = {}

describe('CompletionCommand', () => {
  const userId = 'user123'
  const workflowId = 'workflow456'

  beforeEach(() => {
    jest.clearAllMocks()
    runCommand.mockResolvedValue({success: true})
  })

  it('should throw error when no integration settings found', async () => {
    getIntegrationSettings.mockResolvedValue(null)
    const command = new CompletionCommand(userId, workflowId)
    await expect(command.run(mockCell, mockNodes, mockFiles)).rejects.toThrow('No integration enabled')
  })

  it('should use CUSTOM_LLM_CHAT_QUERY_TYPE when model is default and custom_llm is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: USER_DEFAULT_MODEL,
      custom_llm: true,
    })

    const command = new CompletionCommand(userId, workflowId)
    await command.run(mockCell, mockNodes, mockFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: CUSTOM_LLM_CHAT_QUERY_TYPE}))
  })

  it('should use YANDEX_QUERY_TYPE when lang is ru and yandex is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: USER_DEFAULT_MODEL,
      lang: 'ru',
      yandex: true,
    })

    const command = new CompletionCommand(userId, workflowId)
    await command.run(mockCell, mockNodes, mockFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: YANDEX_QUERY_TYPE}))
  })

  it('should use CHAT_QUERY_TYPE when model is OpenAI and openai is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.OpenAI,
      openai: true,
    })

    const command = new CompletionCommand(userId, workflowId)
    await command.run(mockCell, mockNodes, mockFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: CHAT_QUERY_TYPE}))
  })

  it('should use CLAUDE_QUERY_TYPE when model is Claude and claude is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.Claude,
      claude: true,
    })

    const command = new CompletionCommand(userId, workflowId)
    await command.run(mockCell, mockNodes, mockFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: CLAUDE_QUERY_TYPE}))
  })

  it('should use DEEPSEEK_QUERY_TYPE when model is Deepseek and deepseek is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.Deepseek,
      deepseek: true,
    })

    const command = new CompletionCommand(userId, workflowId)
    await command.run(mockCell, mockNodes, mockFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: DEEPSEEK_QUERY_TYPE}))
  })

  it('should use QWEN_QUERY_TYPE when model is Qwen and qwen is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.Qwen,
      qwen: true,
    })

    const command = new CompletionCommand(userId, workflowId)
    await command.run(mockCell, mockNodes, mockFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: QWEN_QUERY_TYPE}))
  })

  it('should not call runCommand when no matching queryType found', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: 'unknown-model',
    })

    const command = new CompletionCommand(userId, workflowId)
    await command.run(mockCell, mockNodes, mockFiles)

    expect(runCommand).not.toHaveBeenCalled()
  })

  describe('runCommand options', () => {
    it('always passes preventPostProcess: true, delegating output handling to the caller', async () => {
      getIntegrationSettings.mockResolvedValue({model: Model.OpenAI, openai: true})

      const command = new CompletionCommand(userId, workflowId)
      await command.run(mockCell)

      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({preventPostProcess: true}))
    })

    it('always passes preventCommodityForks: true regardless of cell command', async () => {
      getIntegrationSettings.mockResolvedValue({model: Model.OpenAI, openai: true})

      const command = new CompletionCommand(userId, workflowId)
      await command.run(mockCell)

      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({preventCommodityForks: true}))
    })

    it('passes signal: undefined when no signal option is provided', async () => {
      getIntegrationSettings.mockResolvedValue({model: Model.OpenAI, openai: true})

      const command = new CompletionCommand(userId, workflowId)
      await command.run(mockCell)

      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({signal: undefined}))
    })

    it('forwards options.signal to runCommand for abort propagation', async () => {
      getIntegrationSettings.mockResolvedValue({model: Model.OpenAI, openai: true})
      const signal = new AbortController().signal

      const command = new CompletionCommand(userId, workflowId)
      await command.run(mockCell, {signal})

      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({signal}))
    })
  })

  describe('MOCK_EXTERNAL_SERVICES fallback', () => {
    beforeEach(() => {
      process.env.MOCK_EXTERNAL_SERVICES = 'true'
    })

    afterEach(() => {
      delete process.env.MOCK_EXTERNAL_SERVICES
    })

    it('falls back to CHAT_QUERY_TYPE when no provider is configured under mock', async () => {
      getIntegrationSettings.mockResolvedValue({model: USER_DEFAULT_MODEL})

      const command = new CompletionCommand(userId, workflowId)
      await command.run(mockCell, mockNodes, mockFiles)

      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: CHAT_QUERY_TYPE}))
    })

    it('does not override a provider-resolved queryType with the mock fallback', async () => {
      getIntegrationSettings.mockResolvedValue({model: Model.Claude, claude: true})

      const command = new CompletionCommand(userId, workflowId)
      await command.run(mockCell, mockNodes, mockFiles)

      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: CLAUDE_QUERY_TYPE}))
    })
  })
})
