import {CHAT_QUERY_TYPE} from '../../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../../constants/claude'
import {COMPLETION_QUERY_TYPE} from '../../constants/completion'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../../constants/deepseek'
import {DOWNLOAD_QUERY_TYPE} from '../../constants/download'
import {FOREACH_QUERY, FOREACH_QUERY_TYPE} from '../../constants/foreach'
import {MEMORIZE_QUERY, MEMORIZE_QUERY_TYPE} from '../../constants/memorize'
import {OUTLINE_QUERY, OUTLINE_QUERY_TYPE, readSummarizeParam} from '../../constants/outline'
import {PERPLEXITY_QUERY_TYPE} from '../../constants/perplexity'
import {QWEN_QUERY_TYPE} from '../../constants/qwen'
import {REFINE_QUERY} from '../../constants/refine'
import {STEPS_QUERY_TYPE} from '../../constants/steps'
import {SUMMARIZE_QUERY, SUMMARIZE_QUERY_TYPE} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'
import {ValidateCommand} from '../../reliability/core/ValidateCommand'
import {readValidateRetry} from '../../reliability/core/validateParams'
import {CriteriaFailedError} from '../../reliability/core/CriteriaFailedError'
import {resolveRefineCell} from '../../reliability/core/resolveRefineCell'
import RefineTopology from '../../reliability/core/RefineTopology'
import {readCommodityN} from '../../reliability/core/commodityForkParams'
import {
  runCommodityForks,
  isCommodityForkInProgress,
  markCommodityForkInProgress,
} from '../../reliability/core/CommodityForkRunner'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {YANDEX_QUERY_TYPE} from '../../constants/yandex'
import {CONTROL_FLOW_COMMANDS} from '../../constants'
import ProgressReporter from '../../ProgressReporter'
import {CommandFactory} from '../../reliability'
import {stripReliabilitySuffix, appendValidateSuffix} from '../../reliability/core/reliabilitySuffix'
import {getNodeCommand, isOutlineSummarize} from './isCommand'
import {ForeachCommand} from '../ForeachCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import {dispatchDownload} from '../internalResearch/DownloadDispatcher'
import {dispatchMemorize} from '../internalResearch/MemorizeDispatcher'
import {dispatchOutlineSummarize} from '../internalResearch/OutlineSummarizeDispatcher'
import {INTERNAL_RESEARCH_QUERY_TYPES, getResearchAlias} from '../internalResearch/InternalResearchAliasMap'
import {MCPCommand} from '../MCPCommand'
import {MCPFusionCommand} from '../MCPFusionCommand'
import {RPCCommand} from '../RPCCommand'
import {createUnknownCommandNode} from './unknownCommandNode'
// eslint-disable-next-line no-unused-vars
import Store from './Store'

/** @private */
function getCommandName(queryType) {
  const nameMap = {
    [MCP_FUSION_QUERY_TYPE]: 'MCPFusionCommand',
    [YANDEX_QUERY_TYPE]: 'YandexCommand',
    [STEPS_QUERY_TYPE]: 'StepsCommand',
    [CHAT_QUERY_TYPE]: 'ChatCommand',
    [SUMMARIZE_QUERY_TYPE]: 'SummarizeCommand',
    [FOREACH_QUERY_TYPE]: 'ForeachCommand',
    [SWITCH_QUERY_TYPE]: 'SwitchCommand',
    [CLAUDE_QUERY_TYPE]: 'ClaudeCommand',
    [PERPLEXITY_QUERY_TYPE]: 'PerplexityCommand',
    [QWEN_QUERY_TYPE]: 'QwenCommand',
    [DEEPSEEK_QUERY_TYPE]: 'DeepseekCommand',
    [CUSTOM_LLM_CHAT_QUERY_TYPE]: 'CustomLLMChatCommand',
    [COMPLETION_QUERY_TYPE]: 'CompletionCommand',
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

/** @private */
function buildValidateRetryContext(originalContext, criterion, reason) {
  const injected = reason
    ? `[Validation retry] Ensure your response satisfies: "${criterion}". Previous attempt failed because: ${reason}. `
    : `[Validation retry] Ensure your response satisfies: "${criterion}". `
  return injected + (originalContext || '')
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
 *  signal: AbortSignal,
 *  memoMap: Map<string,*>|null
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
    memoMap = null,
  },
  progress,
) => {
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
  } else if (queryType === MCP_FUSION_QUERY_TYPE) {
    const command = new MCPFusionCommand(store._userId, store._workflowId, store)
    await command.run(cell, context, prompt, {signal})
  } else if (queryType === DOWNLOAD_QUERY_TYPE) {
    await dispatchDownload(cell, store, signal)
  } else if (queryType === MEMORIZE_QUERY_TYPE) {
    await dispatchMemorize(cell, store, signal)
  } else if (queryType === OUTLINE_QUERY_TYPE && isOutlineSummarize(getNodeCommand(cell))) {
    await dispatchOutlineSummarize(cell, store, signal)
  } else if (INTERNAL_RESEARCH_QUERY_TYPES.has(queryType)) {
    const alias = getResearchAlias(queryType)
    const command = new MCPCommand(store._userId, store._workflowId, store, alias)
    await command.run(cell, context, prompt, {signal})
  } else if (getCommandName(queryType) || CONTROL_FLOW_COMMANDS.has(queryType)) {
    await executeCommandWithProgress(queryType, context, prompt, cell, store, progress)
  } else {
    createUnknownCommandNode(store, cell)
  }

  if (!isCommodityForkInProgress(cell.id, memoMap)) {
    const commodityN = readCommodityN(queryType, getNodeCommand(cell))
    if (commodityN !== null) {
      if (!memoMap) memoMap = new Map()
      markCommodityForkInProgress(cell.id, memoMap)
      await runCommodityForks({
        cell,
        store,
        n: commodityN,
        queryType,
        mcpAlias,
        rpcAlias,
        signal,
        context,
        prompt,
        memoMap,
      })
    }
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
          await dispatchMemorize(childNode, store, signal)
          flag = true
        } else if (query?.startsWith(OUTLINE_QUERY) && readSummarizeParam(query)) {
          await dispatchOutlineSummarize(childNode, store, signal)
        } else if (query?.startsWith(REFINE_QUERY)) {
          if (!memoMap?.has(childNode.id)) {
            if (!memoMap) memoMap = new Map()
            const refineParent = store.getNode(childNode.parent)
            if (refineParent) {
              for (const {refineNode: inner, depth} of RefineTopology(refineParent, store)) {
                if (depth > 1 && inner.id !== childNode.id && !memoMap.has(inner.id)) {
                  await resolveRefineCell(inner, store, memoMap, signal)
                }
              }
            }
            await resolveRefineCell(childNode, store, memoMap, signal)
          }
        } else if (query?.startsWith(VALIDATE_QUERY)) {
          const remainingValidates = sortedNodes.filter(
            n => getNodeCommand(n)?.startsWith(VALIDATE_QUERY) && !ids.includes(n.id),
          )
          remainingValidates.forEach(v => ids.push(v.id))
          const allValidates = [childNode, ...remainingValidates]

          const maxRetry = Math.max(...allValidates.map(v => readValidateRetry(getNodeCommand(v))))
          const validateCommand = new ValidateCommand(store._userId, store._workflowId, store)
          postProcessTracker = await postProcessProgress.add('ValidateCommand.run')

          let attempt = 0
          let passed = false
          let lastFailCriterion = ''
          let lastFailReason = ''

          while (attempt <= maxRetry) {
            if (attempt > 0) {
              const retryContext = buildValidateRetryContext(context, lastFailCriterion, lastFailReason)
              await executeCommandWithProgress(queryType, retryContext, prompt, cell, store, progress)
              await postProcessNode(
                store.getNode(cell.id),
                allValidates.map(v => v.id),
              )
            }

            const results = await Promise.all(allValidates.map(v => validateCommand.run(v, {signal})))
            const firstFail = results.find(r => !r.passed)

            if (!firstFail) {
              passed = true
              break
            }
            lastFailCriterion = firstFail.criterion
            lastFailReason = firstFail.reason
            attempt++
          }

          const persistValidateSuffixes = succeeded =>
            allValidates.forEach(v => {
              v.title = appendValidateSuffix(v.title || '', {passed: succeeded, retryCount: attempt})
              store.saveNodeToOutput(v.id)
            })

          if (!passed) {
            persistValidateSuffixes(false)
            throw new CriteriaFailedError(lastFailCriterion, attempt)
          }

          persistValidateSuffixes(true)
        }

        if (postProcessTracker) postProcessProgress.remove(postProcessTracker)
        postProcessProgress.dispose()
      } catch (e) {
        if (e instanceof CriteriaFailedError) throw e
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
