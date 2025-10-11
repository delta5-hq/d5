import {CHAT_QUERY_TYPE} from '../../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../../constants/claude'
import {COMPLETION_QUERY_TYPE} from '../../constants/completion'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../../constants/deepseek'
import {DOWNLOAD_QUERY_TYPE} from '../../constants/download'
import {EXT_QUERY_TYPE} from '../../constants/ext'
import {FOREACH_QUERY, FOREACH_QUERY_TYPE} from '../../constants/foreach'
import {MEMORIZE_QUERY, MEMORIZE_QUERY_TYPE} from '../../constants/memorize'
import {OUTLINE_QUERY, OUTLINE_QUERY_TYPE, readSummarizeParam} from '../../constants/outline'
import {PERPLEXITY_QUERY_TYPE} from '../../constants/perplexity'
import {QWEN_QUERY_TYPE} from '../../constants/qwen'
import {REFINE_QUERY_TYPE} from '../../constants/refine'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {STEPS_QUERY_TYPE} from '../../constants/steps'
import {SUMMARIZE_QUERY, SUMMARIZE_QUERY_TYPE} from '../../constants/summarize'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {WEB_QUERY_TYPE} from '../../constants/web'
import {YANDEX_QUERY_TYPE} from '../../constants/yandex'
import ProgressReporter from '../../ProgressReporter'
import {ChatCommand} from '../ChatCommand'
import {ClaudeCommand} from '../ClaudeCommand'
import {CompletionCommand} from '../CompletionCommand'
import {CustomLLMChatCommand} from '../CustomLLMChatCommand'
import {DeepseekCommand} from '../DeepseekCommand'
import {DownloadCommand} from '../DownloadCommand'
import {ExtCommand} from '../ExtCommand'
import {ForeachCommand} from '../ForeachCommand'
import {MemorizeCommand} from '../MemorizeCommand'
import {OutlineCommand} from '../OutlineCommand'
import {PerplexityCommand} from '../PerplexityCommand'
import {QwenCommand} from '../QwenCommand'
import {RefineCommand} from '../RefineCommand'
import {ScholarCommand} from '../ScholarCommand'
import {StepsCommand} from '../StepsCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import {SwitchCommand} from '../SwitchCommand'
import {WebCommand} from '../WebCommand'
import {YandexCommand} from '../YandexCommand'
// eslint-disable-next-line no-unused-vars
import Store from './Store'

/**
 * Executes a command based on the given query type and performs post-processing if needed.
 *
 * @param {Object} params - The parameters for the function
 * @param {string} params.queryType - The type of query to run (e.g., 'yandex', 'web', etc.).=
 * @param {Object} params.context - The prompt context
 * @param {string} params.prompt - The prompt or query text to be processed
 * @param {Object} params.cell - The cell object containing information like its ID and other relevant data for the command execution
 * @param {Store} params.store - The store object, which likely holds the state, user details, and map information
 *
 */
/**
 *
 * @param {{
 *  queryType: string,
 *  context: string,
 *  prompt: string,
 *  cell: import('./Store').NodeData,
 *  store: Store,
 *  preventPostProcess: boolean
 * }} params
 * @param {ProgressReporter} progress
 * @returns
 */
export const runCommand = async ({queryType, context, prompt, cell, store, preventPostProcess = false}, progress) => {
  let runPostProccess = !preventPostProcess
  const postProcessNode = async (node, ids = []) => {
    const sortedNodes = (node.children || [])
      .map(id => store.getNode(id))
      .sort((a, b) => {
        const getOrder = command => {
          if (command?.includes(FOREACH_QUERY)) return 1
          if (command?.includes(SUMMARIZE_QUERY)) return 2
          if (command?.includes(MEMORIZE_QUERY)) return 3
          if (command?.includes(OUTLINE_QUERY) && readSummarizeParam(command)) return 4
          return 5
        }

        return getOrder(a.command) - getOrder(b.command)
      })

    if (node.prompts?.length) {
      ids.push(...node.prompts)
    }

    for (const childNode of sortedNodes) {
      if (ids.includes(childNode.id)) {
        continue
      }

      ids.push(childNode.id)
      const query = childNode.command

      let flag = false

      try {
        const postProcessProgress = new ProgressReporter({title: 'postProcess'}, progress)
        let postProcessTracker

        if (query?.startsWith(FOREACH_QUERY)) {
          const command = new ForeachCommand(
            store._userId,
            store._workflowId,
            store,

            postProcessProgress,
            {usePrompts: true},
          )

          postProcessTracker = await postProcessProgress.add('ForeachCommand.run')
          await command.run(childNode)
        } else if (query?.startsWith(SUMMARIZE_QUERY)) {
          const command = new SummarizeCommand(store._userId, store._workflowId, store)

          postProcessTracker = await postProcessProgress.add('SummarizeCommand.run')
          await command.run(childNode, undefined)

          flag = true
        } else if (query?.startsWith(MEMORIZE_QUERY)) {
          const command = new MemorizeCommand(store._userId, store._workflowId, store)

          postProcessTracker = await postProcessProgress.add('MemorizeCommand.run')
          await command.run(childNode)

          flag = true
        } else if (query?.startsWith(OUTLINE_QUERY) && readSummarizeParam(query)) {
          const command = new OutlineCommand(store._userId, store._workflowId, store)

          postProcessTracker = await postProcessProgress.add('OutlineCommand.run')
          flag = await command.run(childNode, undefined)
        }

        if (postProcessTracker) postProcessProgress.remove(postProcessTracker)
        postProcessProgress.dispose()
      } catch (e) {
        console.error('Error during query post-processing', {query, error: e})
        continue
      }

      if (flag) {
        await postProcessNode(childNode, ids)
      }
    }
  }

  const runCommandProgress = new ProgressReporter({title: 'runCommand'}, progress)
  let runCommandTracker

  if (queryType === YANDEX_QUERY_TYPE) {
    const command = new YandexCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('YandexCommand.run')
    await command.run(cell, context, prompt)
  } else if (queryType === WEB_QUERY_TYPE) {
    const command = new WebCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('WebCommand.run')
    await command.run(cell, prompt)
  } else if (queryType === SCHOLAR_QUERY_TYPE) {
    const command = new ScholarCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('ScholarCommand.run')
    await command.run(cell, prompt)
  } else if (queryType === OUTLINE_QUERY_TYPE) {
    const command = new OutlineCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('OutlineCommand.run')
    await command.run(cell, prompt)
  } else if (queryType === STEPS_QUERY_TYPE) {
    const command = new StepsCommand(store._userId, store._workflowId, store, runCommandProgress)

    runCommandTracker = await runCommandProgress.add('StepsCommand.run')
    await command.run(cell)
    runPostProccess = false // `/steps` command must never trigger postProcessNode, see #226, #227
  } else if (queryType === CHAT_QUERY_TYPE) {
    const command = new ChatCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('ChatCommand.run')
    await command.run(cell, context, prompt)
  } else if (queryType === SUMMARIZE_QUERY_TYPE) {
    const command = new SummarizeCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('SummarizeCommand.run')
    await command.run(cell, prompt)
  } else if (queryType === FOREACH_QUERY_TYPE) {
    const command = new ForeachCommand(store._userId, store._workflowId, store, runCommandProgress)

    runCommandTracker = await runCommandProgress.add('ForeachCommand.run')
    await command.run(cell)
  } else if (queryType === SWITCH_QUERY_TYPE) {
    const command = new SwitchCommand(store._userId, store._workflowId, store, runCommandProgress)

    runCommandTracker = await runCommandProgress.add('SwitchCommand.run')
    await command.run(cell, prompt)
  } else if (queryType === CLAUDE_QUERY_TYPE) {
    const command = new ClaudeCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('ClaudeCommand.run')
    await command.run(cell, context, prompt)
  } else if (queryType === PERPLEXITY_QUERY_TYPE) {
    const command = new PerplexityCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('PerplexityCommand.run')
    await command.run(cell, context, prompt)
  } else if (queryType === QWEN_QUERY_TYPE) {
    const command = new QwenCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('QwenCommand.run')
    await command.run(cell, context, prompt)
  } else if (queryType === DEEPSEEK_QUERY_TYPE) {
    const command = new DeepseekCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('DeepseekCommand.run')
    await command.run(cell, context, prompt)
  } else if (queryType === DOWNLOAD_QUERY_TYPE) {
    const command = new DownloadCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('DownloadCommand.run')
    await command.run(cell, prompt)
  } else if (queryType === CUSTOM_LLM_CHAT_QUERY_TYPE) {
    const command = new CustomLLMChatCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('CustomLLMChatCommand.run')
    await command.run(cell, context, prompt)
  } else if (queryType === REFINE_QUERY_TYPE) {
    const command = new RefineCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('RefineCommand.run')
    await command.run(cell)
  } else if (queryType === EXT_QUERY_TYPE) {
    const command = new ExtCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('ExtCommand.run')
    await command.run(cell, prompt)
  } else if (queryType === COMPLETION_QUERY_TYPE) {
    const command = new CompletionCommand(store._userId, store._workflowId, store)

    runCommandTracker = await runCommandProgress.add('CompletionCommand.run')
    await command.run(cell)
  } else if (queryType === MEMORIZE_QUERY_TYPE) {
    const command = new MemorizeCommand(store._userId, store._workflowId, store, runCommandProgress)

    runCommandTracker = await runCommandProgress.add('MemorizeCommand.run')
    await command.run(cell)
  }

  if (runPostProccess) {
    await postProcessNode(store.getNode(cell.id))
  }

  store.removeOrphanedNodes()

  if (runCommandTracker) runCommandProgress.remove(runCommandTracker)
  runCommandProgress.dispose()
}
