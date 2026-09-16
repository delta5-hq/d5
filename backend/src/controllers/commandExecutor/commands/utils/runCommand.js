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
import {ELECT_QUERY, ELECT_QUERY_TYPE} from '../../constants/elect'
import {REFINE_QUERY, REFINE_QUERY_TYPE} from '../../constants/refine'
import {STEPS_QUERY_TYPE, clearStepsPrefix} from '../../constants/steps'
import {SUMMARIZE_QUERY, SUMMARIZE_QUERY_TYPE} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'
import {readRefineTrailingText} from '../../reliability/core/refineParams'
import {CriteriaFailedError} from '../../reliability/core/CriteriaFailedError'
import {resolveElectCell} from '../../reliability/core/resolveElectCell'
import {resolveRefineCell, REFINE_OUTCOME} from '../../reliability/core/resolveRefineCell'
import {gateOnValidateGroup} from '../../reliability/core/validateGroup'
import {parseInlineTerm} from '../../reliability/core/inlineTermParser'
import {readElectTrailingText} from '../../reliability/core/electParams'
import {createForkProgressEmitter} from '../../reliability/core/ForkProgressEmitter'
import ElectTopology from '../../reliability/core/ElectTopology'
import {SWITCH_QUERY_TYPE} from '../../constants/switch'
import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {isExternalDispatch, isExternalDispatchShape} from '../../reliability/core/externalDispatch'
import {
  dispatchIsExternal,
  externalDispatchRefusalMessage,
  buildExternalDispatchRefusalMetadata,
} from '../../reliability/core/externalDispatchRefusal'
import {isPostProcessorOrControlQuery, hasElectDescendant} from '../../reliability/core/electChildPredicates'
import {YANDEX_QUERY_TYPE} from '../../constants/yandex'
import {CONTROL_FLOW_COMMANDS, modifierQueryTypes} from '../../constants'
import ProgressReporter from '../../ProgressReporter'
import {
  CommandFactory,
  buildInvalidReliabilityMetadata,
  buildSuppressedReliabilityMetadata,
  COMMODITY_SUPPRESSION_CAUSE,
  FAILURE_CAUSE,
  REMEDIATION_HINT,
} from '../../reliability'
import {stripReliabilitySuffix, appendInvalidSuffix} from '../../reliability/core/reliabilitySuffix'
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

/** @private */
function buildRefineTermExecutor(store, progress, signal) {
  return (queryType, context, prompt, cell) =>
    executeCommandWithProgress(queryType, context, prompt, cell, store, progress, buildExecutionOptions(signal))
}

/** @private */
function buildRefinePostProcessor(postProcessNode, store, signal) {
  return async (rootId, excludedIds) => {
    await postProcessNode(store.getNode(rootId), excludedIds)
    throwIfAborted(signal)
  }
}

/**
 * Resolves a top-level inline `/refine :n=N <term>` and, once the best attempt is
 * committed, runs the cell's post-processing children (`/summarize`, `/memorize`,
 * `/outline`, `/foreach`, nested `/elect`) against the refined output — the same
 * subtree handling a top-level `/elect` gives its scope. The refine engine's own
 * per-attempt post-processing stays a no-op because post-processing runs once, on
 * the resolved output, mirroring the bottom-of-dispatch pass. `/validate` children
 * are excluded: {@link resolveRefineCell} already evaluated and applied them.
 *
 * @private
 */
async function resolveRootRefineCell({cell, store, context, queryType, prompt, progress, signal, memoMap}) {
  const outcome = await resolveRefineCell(cell, store, {
    context,
    signal,
    executeTerm: buildRefineTermExecutor(store, progress, signal),
    postProcessTerm: buildRefinePostProcessor(async () => {}, store, signal),
  })
  if (outcome !== REFINE_OUTCOME.RESOLVED) return

  await postProcessExistingOutput({
    node: store.getNode(cell.id),
    ids: validateChildIds(cell, store),
    store,
    progress,
    signal,
    memoMap: memoMap ?? new Map(),
    cell,
    queryType,
    context,
    prompt,
  })
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
function validateChildIds(cell, store) {
  return (store.getNode(cell.id)?.children ?? []).filter(id => isValidate(store.getNode(id)))
}

export function foreachValidateTemplateExclusions(queryType, cell, store) {
  if (queryType !== FOREACH_QUERY_TYPE) return []
  return validateChildIds(cell, store)
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

export async function postProcessExistingOutput({
  node,
  ids = [],
  store,
  progress,
  signal,
  memoMap = new Map(),
  parentIsExternalDispatch = false,
  cell,
  queryType,
  context,
  prompt,
}) {
  if (!node) return

  const postProcessNode = async (currentNode, processedIds = []) => {
    const sortedNodes = (currentNode.children || [])
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

    if (currentNode.prompts?.length) {
      processedIds.push(...currentNode.prompts)
    }

    for (const childNode of sortedNodes) {
      if (signal?.aborted) {
        throwIfAborted(signal)
      }

      if (processedIds.includes(childNode.id)) {
        continue
      }

      processedIds.push(childNode.id)
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
            const electParent = store.getNode(childNode.parent)
            if (electParent) {
              for (const {electNode: inner, depth} of ElectTopology(electParent, store)) {
                if (depth > 1 && inner.id !== childNode.id && !memoMap.has(inner.id)) {
                  await resolveElectCell(inner, store, memoMap, signal)
                }
              }
            }
            const emitter = createForkProgressEmitter(progress)
            await resolveElectCell(childNode, store, memoMap, signal, emitter, true)
          } else if (memoMap?.get(childNode.id) === 'in-progress') {
            for (const electChildId of childNode.children ?? []) {
              const electChild = store.getNode(electChildId)
              if (!electChild || processedIds.includes(electChildId)) continue
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
                processedIds.push(electChildId)
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
            await postProcessNode(childNode, processedIds)
          }
        } else if (isRefine(childNode)) {
          ;(childNode.children ?? [])
            .map(id => store.getNode(id))
            .filter(isValidate)
            .forEach(validateNode => processedIds.push(validateNode.id))

          postProcessTracker = await postProcessProgress.add('RefineCommand.run')
          const outcome = await resolveRefineCell(childNode, store, {
            context,
            parentCell: cell,
            parentQueryType: queryType,
            parentPrompt: prompt,
            parentIsExternalDispatch,
            signal,
            executeTerm: buildRefineTermExecutor(store, progress, signal),
            postProcessTerm: buildRefinePostProcessor(postProcessNode, store, signal),
          })
          if (outcome === REFINE_OUTCOME.INVALID) {
            postProcessProgress.dispose()
            continue
          }
        } else if (isValidate(childNode)) {
          const remainingValidates = sortedNodes.filter(n => isValidate(n) && !processedIds.includes(n.id))
          remainingValidates.forEach(v => processedIds.push(v.id))
          const allValidates = [childNode, ...remainingValidates]
          postProcessTracker = await postProcessProgress.add('ValidateCommand.run')
          await gateOnValidateGroup(allValidates, store, signal)
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
        await postProcessNode(childNode, processedIds)
      }
    }
  }

  await postProcessNode(node, ids)
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
    if (queryType === ELECT_QUERY_TYPE) {
      const trailing = readElectTrailingText(clearStepsPrefix(getNodeCommand(cell)))
      // An external-dispatch-shaped term routes into the resolver too, so its :n=N fan-out is refused
      // by shape rather than misreported as a standalone bare modifier when its alias is unconfigured.
      if (parseInlineTerm(trailing, store._aliases) || isExternalDispatchShape(trailing)) {
        await resolveElectCell(cell, store, memoMap ?? new Map(), signal, createForkProgressEmitter(progress))
        return
      }
    }
    if (queryType === REFINE_QUERY_TYPE) {
      const trailing = readRefineTrailingText(clearStepsPrefix(getNodeCommand(cell)))
      if (parseInlineTerm(trailing, store._aliases) || isExternalDispatchShape(trailing)) {
        await resolveRootRefineCell({
          cell,
          store,
          context,
          queryType,
          prompt,
          progress,
          signal,
          memoMap,
        })
        return
      }
    }
    // A bare modifier at root (no inline term to wrap) has no scope to evaluate and is refused.
    writeModifierRootError(cell, store, queryType)
    return
  }

  const cellNode = store.getNode(cell.id)
  if (cellNode) {
    cellNode.title = stripReliabilitySuffix(cellNode.title || '')
  }

  const externalDispatch = dispatchIsExternal(cell, store) || isExternalDispatch({queryType, mcpAlias, rpcAlias})
  const requestedCommodityN = readCommodityN(getNodeCommand(cell))

  if (externalDispatch && requestedCommodityN > 1) {
    const refusedNode = store.getNode(cell.id)
    if (refusedNode) {
      refusedNode.title = appendInvalidSuffix(refusedNode.title || '')
      refusedNode.reliabilityMetadata = buildExternalDispatchRefusalMetadata(requestedCommodityN, 'commodity')
      store.importer.createErrorNode(externalDispatchRefusalMessage(':n', requestedCommodityN), cell.id)
      store.saveNodeToOutput(cell.id)
    }
    return
  }

  const suppressedForNestedReliability = !preventCommodityForks && store.withinForkExecution && requestedCommodityN > 1
  const commodityN = preventCommodityForks || suppressedForNestedReliability ? 1 : requestedCommodityN

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

  if (suppressedForNestedReliability) {
    const executedNode = store.getNode(cell.id)
    if (executedNode) {
      executedNode.reliabilityMetadata = buildSuppressedReliabilityMetadata({
        cause: COMMODITY_SUPPRESSION_CAUSE.NESTED_RELIABILITY_FORK,
        requestedN: requestedCommodityN,
      })
      store.saveNodeToOutput(cell.id)
    }
  }

  let runPostProccess = !preventPostProcess

  if (queryType === STEPS_QUERY_TYPE) {
    runPostProccess = false
  }

  if (runPostProccess) {
    await postProcessExistingOutput({
      node: store.getNode(cell.id),
      ids: foreachValidateTemplateExclusions(queryType, cell, store),
      store,
      progress,
      signal,
      memoMap: memoMap ?? new Map(),
      parentIsExternalDispatch: externalDispatch,
      cell,
      queryType,
      context,
      prompt,
    })
  }

  store.removeOrphanedNodes()
}
