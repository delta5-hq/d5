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
import {ELECT_QUERY} from '../../constants/elect'
import {REFINE_QUERY} from '../../constants/refine'
import {STEPS_QUERY_TYPE} from '../../constants/steps'
import {SUMMARIZE_QUERY, SUMMARIZE_QUERY_TYPE} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'
import {ValidateCommand} from '../../reliability/core/ValidateCommand'
import {hasValidateRetry, hasValidCriterion} from '../../reliability/core/validateParams'
import {readRawRefineN, readRefineN, readRefineTrailingText} from '../../reliability/core/refineParams'
import {CriteriaFailedError} from '../../reliability/core/CriteriaFailedError'
import {resolveElectCell} from '../../reliability/core/resolveElectCell'
import {createForkProgressEmitter} from '../../reliability/core/ForkProgressEmitter'
import ElectTopology from '../../reliability/core/ElectTopology'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {isSideEffectingDispatch} from '../../reliability/core/sideEffectingDispatch'
import {isPostProcessorOrControlQuery, hasElectDescendant} from '../../reliability/core/electChildPredicates'
import {MEMO_SENTINEL_PRE_EXECUTED_CHILD} from '../../reliability/core/memoSentinels'
import {YANDEX_QUERY_TYPE} from '../../constants/yandex'
import {CONTROL_FLOW_COMMANDS, modifierQueryTypes} from '../../constants'
import ProgressReporter from '../../ProgressReporter'
import {
  CommandFactory,
  buildInvalidReliabilityMetadata,
  buildRefineReliabilityMetadata,
  buildValidateReliabilityMetadata,
  buildSuppressedReliabilityMetadata,
  COMMODITY_SUPPRESSION_CAUSE,
  FAILURE_CAUSE,
  REMEDIATION_HINT,
} from '../../reliability'
import {
  stripReliabilitySuffix,
  appendRefineSuffix,
  appendValidateSuffix,
  appendInvalidSuffix,
} from '../../reliability/core/reliabilitySuffix'
import {getNodeCommand, isElect, isRefine, isValidate, isOutlineSummarize} from './isCommand'
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

function buildRefineAttemptContext(originalContext, criterion, reason) {
  const injected = reason
    ? `[Refinement attempt] Ensure your response satisfies: "${criterion}". Previous attempt failed because: ${reason}. `
    : `[Refinement attempt] Ensure your response satisfies: "${criterion}". `
  return injected + (originalContext || '')
}

function countPassingValidates(results) {
  return results.filter(result => result?.passed).length
}

function firstFailedValidate(results) {
  return results.find(result => !result?.passed)
}

function buildRefineAttempt(attempts, results, store, rootId) {
  return {
    attempts,
    results,
    passedCount: countPassingValidates(results),
    snapshot: captureStoreExecutionSnapshot(store, rootId),
  }
}

function isBetterRefineAttempt(candidate, best) {
  if (!best) return true
  return candidate.passedCount > best.passedCount
}

function writeInvalidModifier(node, store, message, failureCause = FAILURE_CAUSE.INVALID_CRITERIA) {
  const current = store.getNode(node.id) ?? node
  current.title = appendInvalidSuffix(current.title || '')
  current.reliabilityMetadata = buildInvalidReliabilityMetadata({
    failureCause,
    remediationHint: REMEDIATION_HINT.ADJUST_CRITERIA,
  })
  store.importer.createErrorNode(message, current.id)
  store.saveNodeToOutput(current.id)
}

async function evaluateValidateGroup(validates, store, signal) {
  const invalid = validates.filter(
    node => !hasValidCriterion(getNodeCommand(node)) || hasValidateRetry(getNodeCommand(node)),
  )
  if (invalid.length > 0) {
    invalid.forEach(node => {
      const command = getNodeCommand(node)
      const message = hasValidateRetry(command)
        ? 'Error: /validate :retry is unsupported — wrap the generating command with /refine :n=N'
        : 'Error: /validate requires criterion text'
      writeInvalidModifier(node, store, message)
    })
    throw new CriteriaFailedError('', 1)
  }

  const validateCommand = new ValidateCommand(store._userId, store._workflowId, store)
  const results = await Promise.all(validates.map(node => validateCommand.run(node, {signal})))
  validates.forEach((node, index) => {
    const current = store.getNode(node.id) ?? node
    const passed = results[index]?.passed ?? false
    current.title = appendValidateSuffix(current.title || '', {
      passed,
    })
    current.reliabilityMetadata = buildValidateReliabilityMetadata({passed})
    store.saveNodeToOutput(current.id)
  })
  return results
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

  const sideEffectingDispatch = isSideEffectingDispatch({
    queryType,
    mcpAlias,
    rpcAlias,
  })
  const requestedCommodityN = readCommodityN(getNodeCommand(cell))
  const suppressedForNestedReliability = !preventCommodityForks && store.withinForkExecution && requestedCommodityN > 1
  const suppressedForSideEffect = sideEffectingDispatch && requestedCommodityN > 1
  const commodityN =
    preventCommodityForks || suppressedForNestedReliability || suppressedForSideEffect ? 1 : requestedCommodityN

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

  if (suppressedForSideEffect || suppressedForNestedReliability) {
    const executedNode = store.getNode(cell.id)
    if (executedNode) {
      executedNode.reliabilityMetadata = buildSuppressedReliabilityMetadata({
        cause: suppressedForSideEffect
          ? COMMODITY_SUPPRESSION_CAUSE.SIDE_EFFECTING_ALIAS
          : COMMODITY_SUPPRESSION_CAUSE.NESTED_RELIABILITY_FORK,
        requestedN: requestedCommodityN,
      })
      store.saveNodeToOutput(cell.id)
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
          if (command?.includes(ELECT_QUERY)) return 4.5
          if (command?.startsWith(REFINE_QUERY)) return 4.75
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
        } else if (isElect(childNode)) {
          if (!memoMap?.has(childNode.id)) {
            if (!memoMap) memoMap = new Map()
            const electParent = store.getNode(childNode.parent)
            if (electParent) {
              for (const {electNode: inner, depth} of ElectTopology(electParent, store)) {
                if (depth > 1 && inner.id !== childNode.id && !memoMap.has(inner.id)) {
                  await resolveElectCell(inner, store, memoMap, signal)
                }
              }
            }
            const emitter = createForkProgressEmitter(progress)
            await resolveElectCell(childNode, store, memoMap, signal, emitter)
          } else if (memoMap?.get(childNode.id) === 'in-progress') {
            for (const electChildId of childNode.children ?? []) {
              const electChild = store.getNode(electChildId)
              if (!electChild || ids.includes(electChildId)) continue
              const rcQuery = getNodeCommand(electChild)
              if (isPostProcessorOrControlQuery(rcQuery)) continue
              // Skip children whose subtree contains /elect: memoization pre-resolution
              // already ran them; re-running would double-execute per outer fork.
              if (hasElectDescendant(electChild, store)) continue
              const {
                queryType: rcQueryType,
                mcpAlias: rcMcpAlias,
                rpcAlias: rcRpcAlias,
              } = resolveCommand(rcQuery, store._aliases)
              if (rcQueryType) {
                // SubtreeForkRunner pre-executes side-effecting elect children once in the
                // source store and records this sentinel. Every fork observes the cloned
                // output; skipping here is the exactly-once half of that two-part mechanism.
                if (memoMap?.get(electChildId) === MEMO_SENTINEL_PRE_EXECUTED_CHILD) {
                  ids.push(electChildId)
                  continue
                }
                ids.push(electChildId)
                await runCommand(
                  {
                    queryType: rcQueryType,
                    cell: electChild,
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
        } else if (isRefine(childNode)) {
          const query = getNodeCommand(childNode)
          const maxAttempts = readRefineN(query)
          const trailingText = readRefineTrailingText(query)
          const refineValidates = (childNode.children ?? []).map(id => store.getNode(id)).filter(isValidate)

          refineValidates.forEach(node => ids.push(node.id))

          if (!maxAttempts || trailingText) {
            const rawN = readRawRefineN(query)
            writeInvalidModifier(
              childNode,
              store,
              trailingText
                ? `Error: /refine accepts only :n=N; unexpected text: "${trailingText}"`
                : rawN === 0
                ? 'Error: /refine :n=0 is a no-op — minimum is :n=1'
                : 'Error: /refine requires :n=N (e.g. /refine :n=3)',
            )
            postProcessProgress.dispose()
            continue
          }

          if (refineValidates.length === 0) {
            writeInvalidModifier(childNode, store, 'Error: /refine requires at least one direct /validate child')
            postProcessProgress.dispose()
            continue
          }

          postProcessTracker = await postProcessProgress.add('RefineCommand.run')
          let attempts = 1
          let results = await evaluateValidateGroup(refineValidates, store, signal)
          let bestAttempt = buildRefineAttempt(attempts, results, store, cell.id)
          const attemptSnapshots = [bestAttempt.snapshot]
          let firstFail = firstFailedValidate(results)
          const retryWithheld = Boolean(firstFail && sideEffectingDispatch && maxAttempts > 1)

          while (firstFail && attempts < maxAttempts && !sideEffectingDispatch) {
            const retryContext = buildRefineAttemptContext(context, firstFail.criterion, firstFail.reason)
            await executeCommandWithProgress(
              queryType,
              retryContext,
              prompt,
              cell,
              store,
              progress,
              buildExecutionOptions(signal),
            )
            await postProcessNode(store.getNode(cell.id), [childNode.id, ...refineValidates.map(v => v.id)])
            throwIfAborted(signal)
            attempts++
            results = await evaluateValidateGroup(refineValidates, store, signal)
            const currentAttempt = buildRefineAttempt(attempts, results, store, cell.id)
            attemptSnapshots.push(currentAttempt.snapshot)
            if (isBetterRefineAttempt(currentAttempt, bestAttempt)) bestAttempt = currentAttempt
            firstFail = firstFailedValidate(results)
            if (!firstFail) bestAttempt = currentAttempt
          }

          restoreStoreExecutionSnapshot(store, bestAttempt.snapshot, {attemptSnapshots})
          results = bestAttempt.results
          const passed = !firstFailedValidate(results)
          refineValidates.forEach((node, index) => {
            const current = store.getNode(node.id) ?? node
            const validatePassed = results[index]?.passed ?? false
            current.title = appendValidateSuffix(current.title || '', {
              passed: validatePassed,
            })
            current.reliabilityMetadata = buildValidateReliabilityMetadata({passed: validatePassed})
            store.saveNodeToOutput(current.id)
          })
          const currentRefine = store.getNode(childNode.id) ?? childNode
          currentRefine.title = appendRefineSuffix(currentRefine.title || '', {
            passed,
            attempts,
          })
          currentRefine.reliabilityMetadata = buildRefineReliabilityMetadata({
            passed,
            attempts,
            requestedN: maxAttempts,
            ...(retryWithheld
              ? {
                  suppressedCause: COMMODITY_SUPPRESSION_CAUSE.SIDE_EFFECTING_ALIAS,
                }
              : {}),
          })
          store.saveNodeToOutput(currentRefine.id)

          if (!passed) {
            const failed = firstFailedValidate(results)
            throw new CriteriaFailedError(failed?.criterion ?? '', attempts)
          }
        } else if (isValidate(childNode)) {
          const remainingValidates = sortedNodes.filter(n => isValidate(n) && !ids.includes(n.id))
          remainingValidates.forEach(v => ids.push(v.id))
          const allValidates = [childNode, ...remainingValidates]
          postProcessTracker = await postProcessProgress.add('ValidateCommand.run')
          const results = await evaluateValidateGroup(allValidates, store, signal)
          const failed = firstFailedValidate(results)
          if (failed) throw new CriteriaFailedError(failed.criterion, 1)
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
