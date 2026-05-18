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

  async run(cell, options = {}) {
    if (!this.store) {
      return this._resolveAndRun(cell, options)
    }
    return runWithErrorNode(this.store, cell, this.logError.bind(this), () => this._resolveAndRun(cell, options))
  }

  async _resolveAndRun(cell, options = {}) {
    const {signal} = options
    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    if (!settings) throw new Error('No integration enabled')

    const {model, lang} = settings

    let queryType = null

    if (!model || model === USER_DEFAULT_MODEL) {
      if (settings.custom_llm) {
        queryType = CUSTOM_LLM_CHAT_QUERY_TYPE
      } else if (lang === 'ru' && settings.yandex) {
        queryType = YANDEX_QUERY_TYPE
      } else if (settings.openai) {
        queryType = CHAT_QUERY_TYPE
      } else if (settings.claude) {
        queryType = CLAUDE_QUERY_TYPE
      } else if (settings.qwen) {
        queryType = QWEN_QUERY_TYPE
      } else if (settings.deepseek) {
        queryType = DEEPSEEK_QUERY_TYPE
      }
    }

    if (model === Model.OpenAI && settings.openai) {
      queryType = CHAT_QUERY_TYPE
    } else if (model === Model.YandexGPT && settings.yandex) {
      queryType = YANDEX_QUERY_TYPE
    } else if (model === Model.Deepseek && settings.deepseek) {
      queryType = DEEPSEEK_QUERY_TYPE
    } else if (model === Model.Claude && settings.claude) {
      queryType = CLAUDE_QUERY_TYPE
    } else if (model === Model.Qwen && settings.qwen) {
      queryType = QWEN_QUERY_TYPE
    } else if (model === Model.CustomLLM && settings.custom_llm) {
      queryType = CUSTOM_LLM_CHAT_QUERY_TYPE
    }

    if (!queryType && process.env.MOCK_EXTERNAL_SERVICES === 'true') {
      queryType = CHAT_QUERY_TYPE
    }

    if (queryType) {
      return runCommand(
        {
          queryType,
          cell,
          store: this.store,
          preventPostProcess: true,
          signal,
        },
        this.progress,
      )
    }
  }
}
