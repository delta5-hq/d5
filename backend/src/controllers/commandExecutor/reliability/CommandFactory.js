import {ChatCommand} from '../commands/ChatCommand'
import {ClaudeCommand} from '../commands/ClaudeCommand'
import {CompletionCommand} from '../commands/CompletionCommand'
import {CustomLLMChatCommand} from '../commands/CustomLLMChatCommand'
import {DeepseekCommand} from '../commands/DeepseekCommand'
import {DownloadCommand} from '../commands/DownloadCommand'
import {ExtCommand} from '../commands/ExtCommand'
import {ForeachCommand} from '../commands/ForeachCommand'
import {MemorizeCommand} from '../commands/MemorizeCommand'
import {OutlineCommand} from '../commands/OutlineCommand'
import {PerplexityCommand} from '../commands/PerplexityCommand'
import {QwenCommand} from '../commands/QwenCommand'
import {RefineCommand} from '../commands/RefineCommand'
import {ScholarCommand} from '../commands/ScholarCommand'
import {StepsCommand} from '../commands/StepsCommand'
import {SummarizeCommand} from '../commands/SummarizeCommand'
import {SwitchCommand} from '../commands/SwitchCommand'
import {WebCommand} from '../commands/WebCommand'
import {YandexCommand} from '../commands/YandexCommand'

import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {COMPLETION_QUERY_TYPE} from '../constants/completion'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {DOWNLOAD_QUERY_TYPE} from '../constants/download'
import {EXT_QUERY_TYPE} from '../constants/ext'
import {FOREACH_QUERY_TYPE} from '../constants/foreach'
import {MEMORIZE_QUERY_TYPE} from '../constants/memorize'
import {OUTLINE_QUERY_TYPE} from '../constants/outline'
import {PERPLEXITY_QUERY_TYPE} from '../constants/perplexity'
import {QWEN_QUERY_TYPE} from '../constants/qwen'
import {REFINE_QUERY_TYPE} from '../constants/refine'
import {SCHOLAR_QUERY_TYPE} from '../constants/scholar'
import {STEPS_QUERY_TYPE} from '../constants/steps'
import {SUMMARIZE_QUERY_TYPE} from '../constants/summarize'
import {SWITCH_QUERY_TYPE} from '../constants/switch'
import {WEB_QUERY_TYPE} from '../constants/web'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'

/**
 * Factory for creating command instances
 * Centralizes command instantiation logic for cleaner best-of-N integration
 */
class CommandFactory {
  static LLM_QUERY_TYPES = new Set([
    CHAT_QUERY_TYPE,
    CLAUDE_QUERY_TYPE,
    DEEPSEEK_QUERY_TYPE,
    QWEN_QUERY_TYPE,
    PERPLEXITY_QUERY_TYPE,
    CUSTOM_LLM_CHAT_QUERY_TYPE,
    YANDEX_QUERY_TYPE,
    REFINE_QUERY_TYPE,
    OUTLINE_QUERY_TYPE,
    SUMMARIZE_QUERY_TYPE,
  ])

  static ORCHESTRATOR_QUERY_TYPES = new Set([STEPS_QUERY_TYPE, FOREACH_QUERY_TYPE, SWITCH_QUERY_TYPE])

  static createCommand(queryType, store, progress) {
    const {_userId: userId, _workflowId: workflowId} = store

    switch (queryType) {
      case YANDEX_QUERY_TYPE:
        return new YandexCommand(userId, workflowId, store)
      case WEB_QUERY_TYPE:
        return new WebCommand(userId, workflowId, store)
      case SCHOLAR_QUERY_TYPE:
        return new ScholarCommand(userId, workflowId, store)
      case OUTLINE_QUERY_TYPE:
        return new OutlineCommand(userId, workflowId, store)
      case STEPS_QUERY_TYPE:
        return new StepsCommand(userId, workflowId, store, progress)
      case CHAT_QUERY_TYPE:
        return new ChatCommand(userId, workflowId, store)
      case SUMMARIZE_QUERY_TYPE:
        return new SummarizeCommand(userId, workflowId, store)
      case FOREACH_QUERY_TYPE:
        return new ForeachCommand(userId, workflowId, store, progress)
      case SWITCH_QUERY_TYPE:
        return new SwitchCommand(userId, workflowId, store, progress)
      case CLAUDE_QUERY_TYPE:
        return new ClaudeCommand(userId, workflowId, store)
      case PERPLEXITY_QUERY_TYPE:
        return new PerplexityCommand(userId, workflowId, store)
      case QWEN_QUERY_TYPE:
        return new QwenCommand(userId, workflowId, store)
      case DEEPSEEK_QUERY_TYPE:
        return new DeepseekCommand(userId, workflowId, store)
      case DOWNLOAD_QUERY_TYPE:
        return new DownloadCommand(userId, workflowId, store)
      case CUSTOM_LLM_CHAT_QUERY_TYPE:
        return new CustomLLMChatCommand(userId, workflowId, store)
      case REFINE_QUERY_TYPE:
        return new RefineCommand(userId, workflowId, store)
      case EXT_QUERY_TYPE:
        return new ExtCommand(userId, workflowId, store)
      case COMPLETION_QUERY_TYPE:
        return new CompletionCommand(userId, workflowId, store, progress)
      case MEMORIZE_QUERY_TYPE:
        return new MemorizeCommand(userId, workflowId, store, progress)
      default:
        return null
    }
  }

  static isLLMCommand(queryType) {
    return this.LLM_QUERY_TYPES.has(queryType)
  }

  static isOrchestrator(queryType) {
    return this.ORCHESTRATOR_QUERY_TYPES.has(queryType)
  }

  /**
   * Create a command runner function with correct arity for the given queryType
   * Encapsulates per-command run() signature differences
   *
   * @param {string} queryType
   * @param {Object} cell - Command cell node
   * @param {string} context - Context string
   * @param {string} prompt - Prompt string
   * @returns {Function} (store, progress) => Promise<void>
   */
  static createRunner(queryType, cell, context, prompt) {
    return async (store, progress) => {
      const command = this.createCommand(queryType, store, progress)
      const resolvedCell = store.getNode(cell.id) || cell

      switch (queryType) {
        case CHAT_QUERY_TYPE:
        case CLAUDE_QUERY_TYPE:
        case PERPLEXITY_QUERY_TYPE:
        case QWEN_QUERY_TYPE:
        case DEEPSEEK_QUERY_TYPE:
        case CUSTOM_LLM_CHAT_QUERY_TYPE:
        case YANDEX_QUERY_TYPE:
          return command.run(resolvedCell, context, prompt)

        case OUTLINE_QUERY_TYPE:
        case SUMMARIZE_QUERY_TYPE:
        case SCHOLAR_QUERY_TYPE:
        case WEB_QUERY_TYPE:
        case DOWNLOAD_QUERY_TYPE:
        case EXT_QUERY_TYPE:
        case SWITCH_QUERY_TYPE:
          return command.run(resolvedCell, prompt)

        case REFINE_QUERY_TYPE:
        case COMPLETION_QUERY_TYPE:
        case MEMORIZE_QUERY_TYPE:
        case FOREACH_QUERY_TYPE:
        case STEPS_QUERY_TYPE:
          return command.run(resolvedCell)

        default:
          throw new Error(`Unknown queryType: ${queryType}`)
      }
    }
  }
}

export default CommandFactory
