import debug from 'debug'
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
import {readValidateRetry, hasValidCriterion} from '../../reliability/core/validateParams'
import {CriteriaFailedError} from '../../reliability/core/CriteriaFailedError'
import {resolveRefineCell} from '../../reliability/core/resolveRefineCell'
import {createForkProgressEmitter} from '../../reliability/core/ForkProgressEmitter'
import RefineTopology from '../../reliability/core/RefineTopology'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {YANDEX_QUERY_TYPE} from '../../constants/yandex'
import {CONTROL_FLOW_COMMANDS, modifierQueryTypes} from '../../constants'
import ProgressReporter from '../../ProgressReporter'
import {CommandFactory, buildInvalidReliabilityMetadata, FAILURE_CAUSE, REMEDIATION_HINT} from '../../reliability'
import {
  stripReliabilitySuffix,
  appendValidateSuffix,
  appendInvalidSuffix,
} from '../../reliability/core/reliabilitySuffix'
import {getNodeCommand, isValidate, isOutlineSummarize} from './isCommand'
import {mergeCommodityForkOutputs} from '../../reliability/core/commodityForkMerge'
import {resolveCommand} from './queryTypeResolver'
import {ForeachCommand} from '../ForeachCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import {dispatchDownload} from '../internalResearch/DownloadDispatcher'
import {dispatchMemorize} from '../internalResearch/MemorizeDispatcher'
import {dispatchOutlineSummarize} from '../internalResearch/OutlineSummarizeDispatcher'
import {INTERNAL_RESEARCH_QUERY_TYPES, getResearchAlias} from '../internalResearch/InternalResearchAliasMap'
import {
  buildInternalResearchToolStaticArgs,
  cleanInternalResearchPrompt,
} from '../internalResearch/ResearchToolStaticArgs'
import {MCPCommand} from '../MCPCommand'
import {MCPFusionCommand} from '../MCPFusionCommand'
import {RPCCommand} from '../RPCCommand'
import {createUnknownCommandNode} from './unknownCommandNode'
import StoreFork from '../../reliability/core/StoreFork'
import {readCommodityN, stripCommodityN, stripCommodityToken} from '../../reliability/core/commodityParams'
import {
  captureStoreExecutionSnapshot,
  restoreStoreExecutionSnapshot,
} from '../../reliability/core/StoreExecutionSnapshot'
import {throwIfAborted, signalOptions, isAbortError} from './executionSignal'

// eslint-disable-next-line no-unused-vars
import Store from './Store'

const logError = debug('delta5:app:runCommand:error')

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
async function executeCommandWithProgress(queryType, context, prompt, cell, store, progress, options = {}) {
  throwIfAborted(options.signal)
  const runCommandProgress = new ProgressReporter({title: 'runCommand'}, progress)
  const commandName = getCommandName(queryType)
  const runCommandTracker = commandName ? await runCommandProgress.add(`${commandName}.run`) : null

  try {
    const commandRunner = CommandFactory.createRunner(queryType, cell, context, prompt, options)
    await commandRunner(store, runCommandProgress)
    throwIfAborted(options.signal)
  } finally {
    if (runCommandTracker) runCommandProgress.remove(runCommandTracker)
    runCommandProgress.dispose()
  }
}

/** @private */
function buildExecutionOptions(signal) {
  return signalOptions(signal) ?? {}
}

function buildValidateRetryContext(originalContext, criterion, reason) {
  const injected = reason
    ? `[Validation retry] Ensure your response satisfies: "${criterion}". Previous attempt failed because: ${reason}. `
    : `[Validation retry] Ensure your response satisfies: "${criterion}". `
  return injected + (originalContext || '')
}

function countPassingValidates(results) {
  return results.filter(result => result?.passed).length
}

function firstFailedValidate(results) {
  return results.find(result => !result?.passed)
}

function buildValidateAttempt(attempt, results, store, rootId) {
  return {
    attempt,
    results,
    passedCount: countPassingValidates(results),
    snapshot: captureStoreExecutionSnapshot(store, rootId),
  }
}

function isBetterValidateAttempt(candidate, best) {
  if (!best) return true
  return candidate.passedCount > best.passedCount
}

/**
 * Runs N independent forks of a commodity cell and merges their outcomes back
 * into `store` (success-gated prompt nodes + commodity reliabilityMetadata/suffix).
 *
 * Each fork executes through the full `runCommand` dispatch so MCP/RPC aliases
 * and internal-research verbs route correctly; `mcpAlias`/`rpcAlias` are threaded
 * through. Fork stores carry `withinForkExecution = true` (set by
 * StoreFork.createFork) and `preventCommodityForks: true`, which is the re-entry
 * guard preventing a fork from recursively re-forking. Forks skip post-processing
 * (`preventPostProcess: true`); post-processing runs once on the merged result.
 *
 * @private
 */
async function runCommodityForks({
  queryType,
  context,
  prompt,
  cell,
  store,
  progress,
  n,
  mcpAlias,
  rpcAlias,
  signal,
  memoMap,
}) {
  throwIfAborted(signal)
  const cleanPrompt = stripCommodityN(prompt || '')
  const forkStores = Array.from({length: n}, () => StoreFork.createFork(store))
  await Promise.allSettled(
    forkStores.map(forkStore =>
      runCommand(
        {
          queryType,
          context,
          prompt: cleanPrompt,
          cell: forkStore.getNode(cell.id) || cell,
          store: forkStore,
          mcpAlias,
          rpcAlias,
          signal,
          memoMap,
          preventCommodityForks: true,
          preventPostProcess: true,
        },
        progress,
      ),
    ),
  )
  throwIfAborted(signal)

  mergeCommodityForkOutputs({store, forkStores, cellId: cell.id, total: n})
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
/** @private */
function hasRefineDescendant(node, store) {
  for (const childId of node.children ?? []) {
    const child = store.getNode(childId)
    if (!child) continue
    if (getNodeCommand(child)?.startsWith(REFINE_QUERY)) return true
    if (hasRefineDescendant(child, store)) return true
  }
  return false
}

function foreachValidateTemplateExclusions(queryType, cell, store) {
  if (queryType !== FOREACH_QUERY_TYPE) return []
  return (store.getNode(cell.id)?.children ?? []).filter(id => isValidate(store.getNode(id)))
}

function writeModifierRootError(cell, store, queryType) {
  const cellNode = store.getNode(cell.id)
  if (!cellNode) return
  cellNode.title = appendInvalidSuffix(stripReliabilitySuffix(cellNode.title || ''))
  cellNode.reliabilityMetadata = buildInvalidReliabilityMetadata({
    failureCause: FAILURE_CAUSE.MISSING_PARENT,
    remediationHint: REMEDIATION_HINT.NONE,
  })
  store.importer.createErrorNode(
    `/${queryType} requires a parent cell — it cannot be used as a standalone command`,
    cell.id,
  )
  store.saveNodeToOutput(cell.id)
}

function sanitizeAliasDispatchInputs(cell, prompt) {
  return {
    sanitizedCell: {
      ...cell,
      command: stripCommodityToken(cell.command),
      title: stripCommodityToken(cell.title),
    },
    sanitizedPrompt: stripCommodityToken(prompt),
  }
}

export const runCommand = async (
  {
    queryType,
    context,
    prompt,
    cell,
    store,
    preventPostProcess = false,
    preventCommodityForks = false,
    mcpAlias,
    rpcAlias,
    sshClientPool = null,
    signal,
    memoMap = null,
  },
  progress,
) => {
  if (modifierQueryTypes.includes(queryType)) {
    writeModifierRootError(cell, store, queryType)
    return
  }

  const cellNode = store.getNode(cell.id)
  if (cellNode) {
    cellNode.title = stripReliabilitySuffix(cellNode.title || '')
  }

  const commodityN = preventCommodityForks || store.withinForkExecution ? 1 : readCommodityN(getNodeCommand(cell))

  if (commodityN > 1) {
    await runCommodityForks({
      queryType,
      context,
      prompt,
      cell,
      store,
      progress,
      n: commodityN,
      mcpAlias,
      rpcAlias,
      signal,
      memoMap,
    })
  } else if (mcpAlias) {
    const {sanitizedCell, sanitizedPrompt} = sanitizeAliasDispatchInputs(cell, prompt)
    const command = new MCPCommand(store._userId, store._workflowId, store, mcpAlias)
    await command.run(sanitizedCell, context, sanitizedPrompt, {signal})
  } else if (rpcAlias) {
    const {sanitizedCell, sanitizedPrompt} = sanitizeAliasDispatchInputs(cell, prompt)
    const command = new RPCCommand(store._userId, store._workflowId, store, rpcAlias, progress, sshClientPool)
    await command.run(sanitizedCell, context, sanitizedPrompt, {signal})
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
    const nodeCommand = getNodeCommand(cell) || ''
    const alias = {
      ...getResearchAlias(queryType),
      toolStaticArgs: buildInternalResearchToolStaticArgs(queryType, nodeCommand),
    }
    const researchPrompt = cleanInternalResearchPrompt(prompt || nodeCommand)
    const command = new MCPCommand(store._userId, store._workflowId, store, alias)
    await command.run(cell, context, researchPrompt, {signal})
  } else if (getCommandName(queryType) || CONTROL_FLOW_COMMANDS.has(queryType)) {
    await executeCommandWithProgress(queryType, context, prompt, cell, store, progress, buildExecutionOptions(signal))
  } else {
    createUnknownCommandNode(store, cell)
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
          if (command?.startsWith(VALIDATE_QUERY)) return 5
          return 6
        }

        return getOrder(getNodeCommand(a)) - getOrder(getNodeCommand(b))
      })

    if (node.prompts?.length) {
      ids.push(...node.prompts)
    }

    for (const childNode of sortedNodes) {
      if (signal?.aborted) {
        throwIfAborted(signal)
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
            const emitter = createForkProgressEmitter(progress)
            await resolveRefineCell(childNode, store, memoMap, signal, emitter)
          } else if (memoMap?.get(childNode.id) === 'in-progress') {
            // Execute non-post-processor children of /refine via runCommand so they
            // produce output that /validate and post-processors can then verify.
            for (const refineChildId of childNode.children ?? []) {
              const refineChild = store.getNode(refineChildId)
              if (!refineChild || ids.includes(refineChildId)) continue
              const rcQuery = getNodeCommand(refineChild)
              if (
                !rcQuery ||
                rcQuery.startsWith(FOREACH_QUERY) ||
                rcQuery.startsWith(SUMMARIZE_QUERY) ||
                rcQuery.startsWith(MEMORIZE_QUERY) ||
                rcQuery.startsWith(REFINE_QUERY) ||
                rcQuery.startsWith(VALIDATE_QUERY) ||
                (rcQuery.startsWith(OUTLINE_QUERY) && readSummarizeParam(rcQuery))
              ) {
                continue
              }
              // Skip children whose subtree contains /refine: memoization pre-resolution
              // already ran them; re-running would double-execute per outer fork.
              if (hasRefineDescendant(refineChild, store)) continue
              const {
                queryType: rcQueryType,
                mcpAlias: rcMcpAlias,
                rpcAlias: rcRpcAlias,
              } = resolveCommand(rcQuery, store._aliases)
              if (rcQueryType) {
                ids.push(refineChildId)
                await runCommand(
                  {
                    queryType: rcQueryType,
                    cell: refineChild,
                    store,
                    mcpAlias: rcMcpAlias,
                    rpcAlias: rcRpcAlias,
                    signal,
                    memoMap,
                  },
                  progress,
                )
              }
            }
            await postProcessNode(childNode, ids)
          }
        } else if (isValidate(childNode)) {
          const remainingValidates = sortedNodes.filter(n => isValidate(n) && !ids.includes(n.id))
          remainingValidates.forEach(v => ids.push(v.id))
          const allValidates = [childNode, ...remainingValidates]

          const emptyCriterionNodes = allValidates.filter(v => !hasValidCriterion(getNodeCommand(v)))
          if (emptyCriterionNodes.length > 0) {
            emptyCriterionNodes.forEach(v => {
              v.title = appendInvalidSuffix(v.title || '')
              v.reliabilityMetadata = buildInvalidReliabilityMetadata({
                failureCause: FAILURE_CAUSE.INVALID_CRITERIA,
                remediationHint: REMEDIATION_HINT.ADJUST_CRITERIA,
              })
              store.saveNodeToOutput(v.id)
            })
            throw new CriteriaFailedError('', 0)
          }

          const maxRetry = Math.max(...allValidates.map(v => readValidateRetry(getNodeCommand(v))))
          const validateCommand = new ValidateCommand(store._userId, store._workflowId, store)
          postProcessTracker = await postProcessProgress.add('ValidateCommand.run')

          let attempt = 0
          let passed = false
          let lastFailCriterion = ''
          let lastFailReason = ''
          let lastResults = allValidates.map(() => ({
            passed: false,
            criterion: '',
            reason: '',
          }))
          let bestAttempt = null

          while (attempt <= maxRetry) {
            if (attempt > 0) {
              const retryContext = buildValidateRetryContext(context, lastFailCriterion, lastFailReason)
              await executeCommandWithProgress(
                queryType,
                retryContext,
                prompt,
                cell,
                store,
                progress,
                buildExecutionOptions(signal),
              )
              await postProcessNode(
                store.getNode(cell.id),
                allValidates.map(v => v.id),
              )
            }

            throwIfAborted(signal)
            lastResults = await Promise.all(allValidates.map(v => validateCommand.run(v, {signal})))
            const currentAttempt = buildValidateAttempt(attempt, lastResults, store, cell.id)
            if (isBetterValidateAttempt(currentAttempt, bestAttempt)) {
              bestAttempt = currentAttempt
            }

            const firstFail = firstFailedValidate(lastResults)

            if (!firstFail) {
              passed = true
              bestAttempt = currentAttempt
              break
            }
            lastFailCriterion = firstFail.criterion
            lastFailReason = firstFail.reason
            attempt++
          }

          if (bestAttempt) {
            restoreStoreExecutionSnapshot(store, bestAttempt.snapshot)
            lastResults = bestAttempt.results
          }

          allValidates.forEach((v, i) => {
            const validateNode = store.getNode(v.id) ?? v
            const cellPassed = lastResults[i]?.passed ?? false
            const retryCount = cellPassed && !passed ? Math.max(0, attempt - 1) : attempt
            validateNode.title = appendValidateSuffix(validateNode.title || '', {
              passed: cellPassed,
              retryCount,
            })
            store.saveNodeToOutput(validateNode.id)
          })

          if (!passed) {
            const bestFail = firstFailedValidate(lastResults)
            throw new CriteriaFailedError(bestFail?.criterion ?? lastFailCriterion, attempt)
          }
        }

        if (postProcessTracker) postProcessProgress.remove(postProcessTracker)
        postProcessProgress.dispose()
      } catch (e) {
        if (isAbortError(e)) throw e
        if (e instanceof CriteriaFailedError) throw e
        logError('post-processing failed: %o', {query, error: e})
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
    await postProcessNode(store.getNode(cell.id), foreachValidateTemplateExclusions(queryType, cell, store))
  }

  store.removeOrphanedNodes()
}
