import {CompletionCommand} from './CompletionCommand'
import {USER_DEFAULT_MODEL} from '../../../shared/config/constants'
import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {QWEN_QUERY_TYPE} from '../constants/qwen'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'
import {Model, getIntegrationSettings} from './utils/langchain/getLLM'
import {runCommand} from './utils/runCommand'

jest.mock('./utils/langchain/getLLM')
jest.mock('./utils/runCommand')

const mockCell = {id: 'cell1'}

const makeStore = () => ({
  importer: {createNodes: jest.fn()},
  _integrationSettingsCache: null,
})

const settingsWith = overrides => ({model: USER_DEFAULT_MODEL, ...overrides})

describe('CompletionCommand', () => {
  const userId = 'user123'
  const workflowId = 'workflow456'

  beforeEach(() => {
    jest.clearAllMocks()
    runCommand.mockResolvedValue({success: true})
  })

  describe('provider resolution — auto-detect mode', () => {
    it.each([
      ['custom_llm is configured', {custom_llm: true}, CUSTOM_LLM_CHAT_QUERY_TYPE],
      ['openai is configured', {openai: true}, CHAT_QUERY_TYPE],
      ['claude is configured', {claude: true}, CLAUDE_QUERY_TYPE],
      ['qwen is configured', {qwen: true}, QWEN_QUERY_TYPE],
      ['deepseek is configured', {deepseek: true}, DEEPSEEK_QUERY_TYPE],
      ['yandex is configured and lang is ru', {yandex: true, lang: 'ru'}, YANDEX_QUERY_TYPE],
    ])('selects correct queryType when %s', async (_label, providerSettings, expectedQueryType) => {
      getIntegrationSettings.mockResolvedValue(settingsWith(providerSettings))
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: expectedQueryType}))
    })

    it.each([
      ['custom_llm beats openai', {custom_llm: true, openai: true}, CUSTOM_LLM_CHAT_QUERY_TYPE],
      [
        'custom_llm beats yandex when lang is ru',
        {custom_llm: true, yandex: true, lang: 'ru'},
        CUSTOM_LLM_CHAT_QUERY_TYPE,
      ],
      ['yandex (lang=ru) beats openai', {yandex: true, openai: true, lang: 'ru'}, YANDEX_QUERY_TYPE],
      ['openai beats claude', {openai: true, claude: true}, CHAT_QUERY_TYPE],
    ])('priority: %s', async (_label, providerSettings, expectedQueryType) => {
      getIntegrationSettings.mockResolvedValue(settingsWith(providerSettings))
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: expectedQueryType}))
    })

    it.each([
      ['USER_DEFAULT_MODEL', USER_DEFAULT_MODEL],
      ['null', null],
      ['undefined', undefined],
    ])('treats model=%s as auto-detect mode', async (_label, model) => {
      getIntegrationSettings.mockResolvedValue({model, openai: true})
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: CHAT_QUERY_TYPE}))
    })

    it('skips yandex and falls through to the next configured provider when lang is not ru', async () => {
      getIntegrationSettings.mockResolvedValue(settingsWith({yandex: true, lang: 'en', openai: true}))
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: CHAT_QUERY_TYPE}))
    })
  })

  describe('provider resolution — explicit model mode', () => {
    it.each([
      [Model.OpenAI, 'openai', CHAT_QUERY_TYPE],
      [Model.Claude, 'claude', CLAUDE_QUERY_TYPE],
      [Model.Qwen, 'qwen', QWEN_QUERY_TYPE],
      [Model.Deepseek, 'deepseek', DEEPSEEK_QUERY_TYPE],
      [Model.YandexGPT, 'yandex', YANDEX_QUERY_TYPE],
      [Model.CustomLLM, 'custom_llm', CUSTOM_LLM_CHAT_QUERY_TYPE],
    ])('model=%s with %s configured → correct queryType', async (model, settingsKey, expectedQueryType) => {
      getIntegrationSettings.mockResolvedValue({model, [settingsKey]: true})
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: expectedQueryType}))
    })

    it('selects yandex for explicit YandexGPT model regardless of lang setting', async () => {
      getIntegrationSettings.mockResolvedValue({model: Model.YandexGPT, yandex: true, lang: 'en'})
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: YANDEX_QUERY_TYPE}))
    })
  })

  describe('error surfacing', () => {
    let store

    beforeEach(() => {
      store = makeStore()
    })

    it('creates an error node and does not dispatch when settings are unavailable', async () => {
      getIntegrationSettings.mockResolvedValue(null)
      const command = new CompletionCommand(userId, workflowId, store)
      await command.run(mockCell)
      expect(runCommand).not.toHaveBeenCalled()
      expect(store.importer.createNodes).toHaveBeenCalledWith('Error: No integration enabled', mockCell.id)
    })

    it.each([
      ['auto-detect mode with no providers configured', {model: USER_DEFAULT_MODEL}],
      [
        'auto-detect mode with yandex configured but lang is not ru',
        {model: USER_DEFAULT_MODEL, yandex: true, lang: 'en'},
      ],
      ['explicit model with no credentials for that provider', {model: Model.Claude}],
      ['explicit model not registered in the system', {model: 'unsupported-provider'}],
    ])('creates an error node and does not dispatch when %s', async (_label, settings) => {
      getIntegrationSettings.mockResolvedValue(settings)
      const command = new CompletionCommand(userId, workflowId, store)
      await command.run(mockCell)
      expect(runCommand).not.toHaveBeenCalled()
      expect(store.importer.createNodes).toHaveBeenCalledWith(
        expect.stringMatching(/^Error: No LLM provider/),
        mockCell.id,
      )
    })

    it('creates an error node when runCommand rejects', async () => {
      getIntegrationSettings.mockResolvedValue({model: Model.OpenAI, openai: true})
      runCommand.mockRejectedValue(new Error('downstream failure'))
      const command = new CompletionCommand(userId, workflowId, store)
      await command.run(mockCell)
      expect(store.importer.createNodes).toHaveBeenCalledWith('Error: downstream failure', mockCell.id)
    })

    it('resolves without throwing when store is present, regardless of error type', async () => {
      getIntegrationSettings.mockResolvedValue(null)
      const command = new CompletionCommand(userId, workflowId, store)
      await expect(command.run(mockCell)).resolves.toBeUndefined()
    })
  })

  describe('MOCK_EXTERNAL_SERVICES mode', () => {
    afterEach(() => {
      delete process.env.MOCK_EXTERNAL_SERVICES
    })

    it('dispatches to CHAT_QUERY_TYPE when no provider resolves but MOCK mode is active', async () => {
      process.env.MOCK_EXTERNAL_SERVICES = 'true'
      const store = makeStore()
      getIntegrationSettings.mockResolvedValue({model: USER_DEFAULT_MODEL})
      const command = new CompletionCommand(userId, workflowId, store)
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({queryType: CHAT_QUERY_TYPE}))
      expect(store.importer.createNodes).not.toHaveBeenCalled()
    })
  })

  describe('runCommand argument forwarding', () => {
    beforeEach(() => {
      getIntegrationSettings.mockResolvedValue({model: Model.OpenAI, openai: true})
    })

    it('always sets preventPostProcess to true', async () => {
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({preventPostProcess: true}))
    })

    it('forwards the abort signal to runCommand', async () => {
      const controller = new AbortController()
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell, {signal: controller.signal})
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({signal: controller.signal}))
    })

    it('forwards the cell to runCommand', async () => {
      const command = new CompletionCommand(userId, workflowId, makeStore())
      await command.run(mockCell)
      expect(runCommand.mock.calls[0][0]).toEqual(expect.objectContaining({cell: mockCell}))
    })
  })
})
