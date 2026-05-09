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
import {REFINE_QUERY} from '../../constants/refine'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {STEPS_QUERY_TYPE} from '../../constants/steps'
import {SUMMARIZE_QUERY, SUMMARIZE_QUERY_TYPE} from '../../constants/summarize'
import {VALIDATE_QUERY_TYPE} from '../../constants/validate'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {WEB_QUERY_TYPE} from '../../constants/web'
import {YANDEX_QUERY_TYPE} from '../../constants/yandex'
import ProgressReporter from '../../ProgressReporter'
import {CommandFactory} from '../../reliability'
import {stripReliabilitySuffix} from '../../reliability/core/reliabilitySuffix'
import {getNodeCommand} from './isCommand'
import {ForeachCommand} from '../ForeachCommand'
import {MemorizeCommand} from '../MemorizeCommand'
import {OutlineCommand} from '../OutlineCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import {MCPCommand} from '../MCPCommand'
import {RPCCommand} from '../RPCCommand'
// eslint-disable-next-line no-unused-vars
import Store from './Store'

/** @private */
function getCommandName(queryType) {
  const nameMap = {
    [YANDEX_QUERY_TYPE]: 'YandexCommand',
    [WEB_QUERY_TYPE]: 'WebCommand',
    [SCHOLAR_QUERY_TYPE]: 'ScholarCommand',
    [OUTLINE_QUERY_TYPE]: 'OutlineCommand',
    [STEPS_QUERY_TYPE]: 'StepsCommand',
    [CHAT_QUERY_TYPE]: 'ChatCommand',
    [SUMMARIZE_QUERY_TYPE]: 'SummarizeCommand',
    [FOREACH_QUERY_TYPE]: 'ForeachCommand',
    [SWITCH_QUERY_TYPE]: 'SwitchCommand',
    [CLAUDE_QUERY_TYPE]: 'ClaudeCommand',
    [PERPLEXITY_QUERY_TYPE]: 'PerplexityCommand',
    [QWEN_QUERY_TYPE]: 'QwenCommand',
    [DEEPSEEK_QUERY_TYPE]: 'DeepseekCommand',
    [DOWNLOAD_QUERY_TYPE]: 'DownloadCommand',
    [CUSTOM_LLM_CHAT_QUERY_TYPE]: 'CustomLLMChatCommand',
    [EXT_QUERY_TYPE]: 'ExtCommand',
    [COMPLETION_QUERY_TYPE]: 'CompletionCommand',
    [MEMORIZE_QUERY_TYPE]: 'MemorizeCommand',
  }
  return nameMap[queryType]
}

/** @private */
async function executeCommandWithProgress(queryType, context, prompt, cell, store, progress) {
  const runCommandProgress = new ProgressReporter({title: 'runCommand'}, progress)
  const commandName = getCommandName(queryType)
  const runCommandTracker = commandName ? await runCommandProgress.add(`${commandName}.run`) : null

  try {
    const commandRunner = CommandFactory.createRunner(queryType, cell, context, prompt)
    await commandRunner(store, runCommandProgress)
  } finally {
    if (runCommandTracker) runCommandProgress.remove(runCommandTracker)
    runCommandProgress.dispose()
  }
}

/**
 * @param {{
 *  queryType: string,
 *  context: string,
 *  prompt: string,
 *  cell: import('./Store').NodeData,
 *  store: Store,
 *  preventPostProcess: boolean,
 *  mcpAlias: import('../mcp/aliasResolver').MCPAliasConfig,
 *  rpcAlias: Object,
 *  sshClientPool: Object,
 *  signal: AbortSignal
 * }} params
 * @param {ProgressReporter} progress
 */
export const runCommand = async (
  {
    queryType,
    context,
    prompt,
    cell,
    store,
    preventPostProcess = false,
    mcpAlias,
    rpcAlias,
    sshClientPool = null,
    signal,
  },
  progress,
) => {
  if (queryType === VALIDATE_QUERY_TYPE) {
    return
  }

  const cellNode = store.getNode(cell.id)
  if (cellNode) {
    cellNode.title = stripReliabilitySuffix(cellNode.title || '')
  }

  if (mcpAlias) {
    const command = new MCPCommand(store._userId, store._workflowId, store, mcpAlias)
    await command.run(cell, context, prompt, {signal})
  } else if (rpcAlias) {
    const command = new RPCCommand(store._userId, store._workflowId, store, rpcAlias, progress, sshClientPool)
    await command.run(cell, context, prompt, {signal})
  } else {
    await executeCommandWithProgress(queryType, context, prompt, cell, store, progress)
  }

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
          if (command?.includes(REFINE_QUERY)) return 4.5
          return 5
        }

        return getOrder(getNodeCommand(a)) - getOrder(getNodeCommand(b))
      })

    if (node.prompts?.length) {
      ids.push(...node.prompts)
    }

    for (const childNode of sortedNodes) {
      if (signal?.aborted) {
        break
      }

      if (ids.includes(childNode.id)) {
        continue
      }

      ids.push(childNode.id)
      const query = getNodeCommand(childNode)

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
          await command.run(childNode, {signal})
        } else if (query?.startsWith(SUMMARIZE_QUERY)) {
          const command = new SummarizeCommand(store._userId, store._workflowId, store)

          postProcessTracker = await postProcessProgress.add('SummarizeCommand.run')
          await command.run(childNode, undefined, {signal})

          flag = true
        } else if (query?.startsWith(MEMORIZE_QUERY)) {
          const command = new MemorizeCommand(store._userId, store._workflowId, store)

          postProcessTracker = await postProcessProgress.add('MemorizeCommand.run')
          await command.run(childNode, {signal})

          flag = true
        } else if (query?.startsWith(OUTLINE_QUERY) && readSummarizeParam(query)) {
          const command = new OutlineCommand(store._userId, store._workflowId, store)

          postProcessTracker = await postProcessProgress.add('OutlineCommand.run')
          flag = await command.run(childNode, undefined, {signal})
        } else if (query?.startsWith(REFINE_QUERY)) {
          // P0.1: legacy iterative `/refine` removed. New `/refine :n=N` best-of-N
          // arrives in P0.3-P0.11. Until then, every `/refine` cell produces a
          // visible error so users discover the migration immediately.
          const baseTitle = stripReliabilitySuffix(childNode.title || '')
          childNode.title = `${baseTitle} [✗]`.trim()
          store.importer.createErrorNode('Error: /refine requires :n=N (legacy iterative refine removed)', childNode.id)
          store.saveNodeToOutput(childNode.id)
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

  if (queryType === STEPS_QUERY_TYPE) {
    runPostProccess = false
  }

  if (runPostProccess) {
    await postProcessNode(store.getNode(cell.id))
  }

  store.removeOrphanedNodes()
}
