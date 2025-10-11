import {USER_DEFAULT_MODEL} from '../../../shared/config/constants'
import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {QWEN_QUERY_TYPE} from '../constants/qwen'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'
import {getIntegrationSettings, Model} from './utils/langchain/getLLM'
import {runCommand} from './utils/runCommand'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

/**
 * Class representing a Completion Command.
 */
export class CompletionCommand {
  /**
   * Creates an instance of CompletionCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the map (optional)
   * @param {Store} store - The store object
   * @param {ProgressReporter} progress
   */
  constructor(userId, workflowId, store, progress) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.progress = progress
  }

  async run(cell) {
    const settings = await getIntegrationSettings(this.userId)
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

    if (queryType) {
      return runCommand(
        {
          queryType,
          cell,
          store: this.store,
          preventPostProcess: true,
        },
        this.progress,
      )
    }
  }
}
