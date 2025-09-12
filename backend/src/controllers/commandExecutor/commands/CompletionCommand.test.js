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
const mockMapNodes = {}
const mockMapFiles = {}

describe('CompletionCommand', () => {
  const userId = 'user123'
  const mapId = 'map456'

  beforeEach(() => {
    jest.clearAllMocks()
    runCommand.mockResolvedValue({success: true})
  })

  it('should throw error when no integration settings found', async () => {
    getIntegrationSettings.mockResolvedValue(null)
    const command = new CompletionCommand(userId, mapId)
    await expect(command.run(mockCell, mockMapNodes, mockMapFiles)).rejects.toThrow('No integration enabled')
  })

  it('should use CUSTOM_LLM_CHAT_QUERY_TYPE when model is default and custom_llm is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: USER_DEFAULT_MODEL,
      custom_llm: true,
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: CUSTOM_LLM_CHAT_QUERY_TYPE}))
  })

  it('should use YANDEX_QUERY_TYPE when lang is ru and yandex is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: USER_DEFAULT_MODEL,
      lang: 'ru',
      yandex: true,
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: YANDEX_QUERY_TYPE}))
  })

  it('should use CHAT_QUERY_TYPE when model is OpenAI and openai is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.OpenAI,
      openai: true,
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: CHAT_QUERY_TYPE}))
  })

  it('should use CLAUDE_QUERY_TYPE when model is Claude and claude is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.Claude,
      claude: true,
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: CLAUDE_QUERY_TYPE}))
  })

  it('should use DEEPSEEK_QUERY_TYPE when model is Deepseek and deepseek is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.Deepseek,
      deepseek: true,
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: DEEPSEEK_QUERY_TYPE}))
  })

  it('should use QWEN_QUERY_TYPE when model is Qwen and qwen is enabled', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.Qwen,
      qwen: true,
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(expect.objectContaining({queryType: QWEN_QUERY_TYPE}))
  })

  it('should not call runCommand when no matching queryType found', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: 'unknown-model',
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    expect(runCommand).not.toHaveBeenCalled()
  })

  it('should call runCommand with preventPostProcess set to true', async () => {
    getIntegrationSettings.mockResolvedValue({
      model: Model.OpenAI,
      openai: true,
    })

    const command = new CompletionCommand(userId, mapId)
    await command.run(mockCell, mockMapNodes, mockMapFiles)

    const callArgs = runCommand.mock.calls[0][0]
    expect(callArgs).toEqual(
      expect.objectContaining({
        preventPostProcess: true,
      }),
      undefined,
    )
  })
})
