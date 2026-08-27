import {USER_DEFAULT_MODEL} from '../../../shared/config/constants'
import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {QWEN_QUERY_TYPE} from '../constants/qwen'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'
import debug from 'debug'
import {getIntegrationSettings, Model} from './utils/langchain/getLLM'
import {runWithErrorNode} from './shared/runWithErrorNode'
import {runCommand} from './utils/runCommand'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('delta5:app:Command:Completion')

const NO_PROVIDER_CONFIGURED_ERROR = 'No LLM provider configured. Set an API key in Settings → Integrations.'

const AUTO_DETECT_PROVIDERS = [
  {settingsKey: 'custom_llm', queryType: CUSTOM_LLM_CHAT_QUERY_TYPE},
  {settingsKey: 'yandex', queryType: YANDEX_QUERY_TYPE, condition: s => s.lang === 'ru'},
  {settingsKey: 'openai', queryType: CHAT_QUERY_TYPE},
  {settingsKey: 'claude', queryType: CLAUDE_QUERY_TYPE},
  {settingsKey: 'qwen', queryType: QWEN_QUERY_TYPE},
  {settingsKey: 'deepseek', queryType: DEEPSEEK_QUERY_TYPE},
]

const EXPLICIT_MODEL_PROVIDERS = new Map([
  [Model.OpenAI, {settingsKey: 'openai', queryType: CHAT_QUERY_TYPE}],
  [Model.YandexGPT, {settingsKey: 'yandex', queryType: YANDEX_QUERY_TYPE}],
  [Model.Deepseek, {settingsKey: 'deepseek', queryType: DEEPSEEK_QUERY_TYPE}],
  [Model.Claude, {settingsKey: 'claude', queryType: CLAUDE_QUERY_TYPE}],
  [Model.Qwen, {settingsKey: 'qwen', queryType: QWEN_QUERY_TYPE}],
  [Model.CustomLLM, {settingsKey: 'custom_llm', queryType: CUSTOM_LLM_CHAT_QUERY_TYPE}],
])

const resolveAutoQueryType = settings => {
  for (const entry of AUTO_DETECT_PROVIDERS) {
    if (entry.condition && !entry.condition(settings)) continue
    if (settings[entry.settingsKey]) return entry.queryType
  }
  return null
}

const resolveExplicitQueryType = (model, settings) => {
  const entry = EXPLICIT_MODEL_PROVIDERS.get(model)
  return entry && settings[entry.settingsKey] ? entry.queryType : null
}

const resolveQueryType = settings => {
  const {model} = settings
  return !model || model === USER_DEFAULT_MODEL
    ? resolveAutoQueryType(settings)
    : resolveExplicitQueryType(model, settings)
}

export class CompletionCommand {
  constructor(userId, workflowId, store, progress) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.progress = progress
    this.log = log.extend(userId || 'anon', '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  async run(cell, context, prompt, options = {}) {
    if (!this.store) {
      return this._resolveAndRun(cell, context, prompt, options)
    }
    return runWithErrorNode(this.store, cell, this.logError.bind(this), () =>
      this._resolveAndRun(cell, context, prompt, options),
    )
  }

  async _resolveAndRun(cell, context, prompt, options = {}) {
    const {signal} = options
    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    if (!settings) throw new Error('No integration enabled')

    let queryType = resolveQueryType(settings)

    if (!queryType && process.env.MOCK_EXTERNAL_SERVICES === 'true') {
      queryType = CHAT_QUERY_TYPE
    }

    if (!queryType) {
      throw new Error(NO_PROVIDER_CONFIGURED_ERROR)
    }

    return runCommand(
      {
        queryType,
        context,
        prompt,
        cell,
        store: this.store,
        preventPostProcess: true,
        preventCommodityForks: true,
        signal,
      },
      this.progress,
    )
  }
}
