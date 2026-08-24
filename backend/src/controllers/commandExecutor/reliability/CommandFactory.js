import {ChatCommand} from '../commands/ChatCommand'
import {ClaudeCommand} from '../commands/ClaudeCommand'
import {CompletionCommand} from '../commands/CompletionCommand'
import {CustomLLMChatCommand} from '../commands/CustomLLMChatCommand'
import {DeepseekCommand} from '../commands/DeepseekCommand'
import {ForeachCommand} from '../commands/ForeachCommand'
import {PerplexityCommand} from '../commands/PerplexityCommand'
import {QwenCommand} from '../commands/QwenCommand'
import {ElectCommand} from '../commands/ElectCommand'
import {StepsCommand} from '../commands/StepsCommand'
import {SummarizeCommand} from '../commands/SummarizeCommand'
import {ValidateCommand} from '../commands/ValidateCommand'
import {SwitchCommand} from '../commands/SwitchCommand'
import {YandexCommand} from '../commands/YandexCommand'
import {UnknownQueryTypeError} from './UnknownQueryTypeError'

import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {COMPLETION_QUERY_TYPE} from '../constants/completion'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {FOREACH_QUERY_TYPE} from '../constants/foreach'
import {PERPLEXITY_QUERY_TYPE} from '../constants/perplexity'
import {QWEN_QUERY_TYPE} from '../constants/qwen'
import {ELECT_QUERY_TYPE} from '../constants/elect'
import {STEPS_QUERY_TYPE} from '../constants/steps'
import {SUMMARIZE_QUERY_TYPE} from '../constants/summarize'
import {VALIDATE_QUERY_TYPE} from '../constants/validate'
import {SWITCH_QUERY_TYPE} from '../constants/switch'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'

/**
 * Factory for creating command instances
 * Centralizes command instantiation logic + uniform runner-arity adapter
 */
class CommandFactory {
  static createCommand(queryType, store, progress) {
    const {_userId: userId, _workflowId: workflowId} = store

    switch (queryType) {
      case YANDEX_QUERY_TYPE:
        return new YandexCommand(userId, workflowId, store)
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
      case CUSTOM_LLM_CHAT_QUERY_TYPE:
        return new CustomLLMChatCommand(userId, workflowId, store)
      case COMPLETION_QUERY_TYPE:
        return new CompletionCommand(userId, workflowId, store, progress)
      case ELECT_QUERY_TYPE:
        return new ElectCommand(userId, workflowId, store)
      case VALIDATE_QUERY_TYPE:
        return new ValidateCommand(userId, workflowId, store)
      default:
        return null
    }
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
  static createRunner(queryType, cell, context, prompt, options = {}) {
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
          return command.run(resolvedCell, context, prompt, options)

        case SUMMARIZE_QUERY_TYPE:
        case SWITCH_QUERY_TYPE:
          return command.run(resolvedCell, prompt, options)

        case COMPLETION_QUERY_TYPE:
          return command.run(resolvedCell, context, prompt, options)

        case FOREACH_QUERY_TYPE:
        case STEPS_QUERY_TYPE:
          return command.run(resolvedCell, options)

        case ELECT_QUERY_TYPE:
        case VALIDATE_QUERY_TYPE:
          return command.run(resolvedCell)

        default:
          throw new UnknownQueryTypeError(queryType)
      }
    }
  }
}

export default CommandFactory
