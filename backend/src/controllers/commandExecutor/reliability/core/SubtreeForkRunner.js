import {getNodeCommand} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {foreachValidateTemplateExclusions, postProcessExistingOutput, runCommand} from '../../commands/utils/runCommand'
import NullProgress from './NullProgress'
import StoreFork from './StoreFork'
import {CriteriaFailedError} from './CriteriaFailedError'
import {extractForkLeafOutputs} from './ForkLeafExtractor'
import {isSideEffectingDispatch} from './sideEffectingDispatch'
import {COMMODITY_SUPPRESSION_CAUSE} from './failureSemantics'
import {MEMO_SENTINEL_PRE_EXECUTED_CHILD} from './memoSentinels'
import {isPostProcessorOrControlQuery, hasElectDescendant} from './electChildPredicates'
import {isSideEffectingParent, admitsSourceCandidate} from './sourceCandidateAdmission'

/**
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {import('../../commands/utils/Store').default} Store
 * @typedef {import('./ForkLeafExtractor').LeafOutput} LeafOutput
 */

/**
 * @typedef {Object} ForkResult
 * @property {Store|null} forkStore  - Fork store when execution reached a fork-local store; null before one exists
 * @property {number} forkIndex     - Zero-based index (stable across all N results)
 * @property {'ok'|'runtime-failed'|'criteria-failed'} status
 * @property {string} [reason]      - runtime failure or structural rejection reason
 * @property {string} [failedAt]    - criteria-failed only: criterion that exhausted retries
 * @property {number} [attempts]    - criteria-failed only: retry count attempted
 * @property {LeafOutput[]} leafOutputs - Content preview from the fork's prompt nodes; [] when none available
 * @property {boolean} [suppressed]
 * @property {string} [cause]
 * @property {number} [requestedN]
 */

async function preExecuteSideEffectingElectChildren(electNode, store, memoMap, signal) {
  for (const childId of electNode.children ?? []) {
    if (memoMap.has(childId)) continue
    const child = store.getNode(childId)
    if (!child) continue
    const query = getNodeCommand(child)
    if (isPostProcessorOrControlQuery(query)) continue
    if (hasElectDescendant(child, store)) continue
    const {queryType, mcpAlias, rpcAlias} = resolveCommand(query, store._aliases)
    if (!queryType || !isSideEffectingDispatch({queryType, mcpAlias, rpcAlias})) continue
    await runCommand({queryType, cell: child, store, mcpAlias, rpcAlias, signal, memoMap}, new NullProgress())
    memoMap.set(childId, MEMO_SENTINEL_PRE_EXECUTED_CHILD)
  }
}

function suppressionFields(suppressedForSideEffect, requestedN) {
  return suppressedForSideEffect
    ? {
        suppressed: true,
        cause: COMMODITY_SUPPRESSION_CAUSE.SIDE_EFFECTING_ALIAS,
        requestedN,
      }
    : {}
}

function buildOkResult({forkStore, forkIndex, parentNodeId, suppressedForSideEffect, requestedN}) {
  return {
    forkStore,
    forkIndex,
    status: 'ok',
    leafOutputs: extractForkLeafOutputs(forkStore, parentNodeId),
    ...suppressionFields(suppressedForSideEffect, requestedN),
  }
}

function buildCriteriaFailedResult({forkStore, forkIndex, parentNodeId, error, suppressedForSideEffect, requestedN}) {
  return {
    forkStore,
    forkIndex,
    status: 'criteria-failed',
    failedAt: error.criterion,
    attempts: error.attempts,
    leafOutputs: extractForkLeafOutputs(forkStore, parentNodeId),
    ...suppressionFields(suppressedForSideEffect, requestedN),
  }
}

function buildRuntimeFailedResult({forkIndex, error, suppressedForSideEffect, requestedN}) {
  return {
    forkStore: null,
    forkIndex,
    status: 'runtime-failed',
    reason: error?.message || String(error),
    leafOutputs: [],
    ...suppressionFields(suppressedForSideEffect, requestedN),
  }
}

function buildFailureResult({
  forkStore = null,
  forkIndex,
  parentNodeId = null,
  error,
  suppressedForSideEffect,
  requestedN,
}) {
  if (error instanceof CriteriaFailedError) {
    return buildCriteriaFailedResult({
      forkStore,
      forkIndex,
      parentNodeId,
      error,
      suppressedForSideEffect,
      requestedN,
    })
  }
  return buildRuntimeFailedResult({
    forkIndex,
    error,
    suppressedForSideEffect,
    requestedN,
  })
}

function buildPreExecFailureResults(effectiveN, error) {
  return Array.from({length: effectiveN}, (_, forkIndex) => buildFailureResult({forkIndex, error}))
}

function notifyForkSettled(onForkSettled, result) {
  onForkSettled?.(result)
}

async function runFreshFork({forkStore, forkIndex, parentNode, queryType, mcpAlias, rpcAlias, signal, memoMap, n}) {
  try {
    await runCommand(
      {
        queryType,
        cell: forkStore.getNode(parentNode.id) || parentNode,
        store: forkStore,
        mcpAlias,
        rpcAlias,
        signal,
        memoMap,
      },
      new NullProgress(),
    )
    return buildOkResult({
      forkStore,
      forkIndex,
      parentNodeId: parentNode.id,
      suppressedForSideEffect: false,
      requestedN: n,
    })
  } catch (err) {
    return buildFailureResult({
      forkStore,
      forkIndex,
      parentNodeId: parentNode.id,
      error: err,
      suppressedForSideEffect: false,
      requestedN: n,
    })
  }
}

async function buildSourceCandidateResult({
  forkStore,
  forkIndex,
  parentNode,
  queryType,
  mcpAlias,
  rpcAlias,
  ids,
  signal,
  memoMap,
  suppressedForSideEffect,
  requestedN,
}) {
  try {
    await postProcessExistingOutput({
      node: forkStore.getNode(parentNode.id),
      ids,
      store: forkStore,
      progress: new NullProgress(),
      signal,
      memoMap: new Map(memoMap),
      sideEffectingDispatch: suppressedForSideEffect,
      cell: forkStore.getNode(parentNode.id) || parentNode,
      queryType,
      mcpAlias,
      rpcAlias,
    })
    return buildOkResult({
      forkStore,
      forkIndex,
      parentNodeId: parentNode.id,
      suppressedForSideEffect,
      requestedN,
    })
  } catch (err) {
    return buildFailureResult({
      forkStore,
      forkIndex,
      parentNodeId: parentNode.id,
      error: err,
      suppressedForSideEffect,
      requestedN,
    })
  }
}

/**
 * Sets `electNode.id` in `memoMap` as `'in-progress'` BEFORE the forks run.
 * Each fork receives a fork-local memoMap copy so nested /elect cells are
 * processed independently per fork (preventing cross-fork memoization races),
 * while still containing `electNode.id` to prevent recursive re-entry into
 * this same /elect from within each fork.
 *
 * Returns one result per executed fork, including failures — the caller decides eligibility.
 *
 * @param {{
 *   electNode: NodeData,
 *   store: Store,
 *   n: number,
 *   memoMap: Map<string, *>,
 *   signal?: AbortSignal|null,
 *   onForkSettled?: ((result: ForkResult) => void)|null,
 *   admitSourceCandidate?: boolean,
 * }} params
 * @returns {Promise<ForkResult[]>} one result per executed fork; never throws.
 */
export const runForks = async ({
  electNode,
  store,
  n,
  memoMap,
  signal = null,
  onForkSettled = null,
  admitSourceCandidate = false,
}) => {
  const parentNode = store.getNode(electNode.parent)
  if (!parentNode) {
    throw new Error(`[SubtreeForkRunner] electNode '${electNode.id}' has no parent in store`)
  }

  memoMap.set(electNode.id, 'in-progress')

  const suppressedForSideEffect = n > 1 && isSideEffectingParent(electNode, store)
  const effectiveN = suppressedForSideEffect ? 1 : n

  if (!suppressedForSideEffect && effectiveN > 1) {
    try {
      await preExecuteSideEffectingElectChildren(electNode, store, memoMap, signal)
    } catch (preExecErr) {
      const results = buildPreExecFailureResults(effectiveN, preExecErr)
      results.forEach(r => notifyForkSettled(onForkSettled, r))
      return results
    }
  }

  const {queryType, mcpAlias, rpcAlias} = resolveCommand(getNodeCommand(parentNode), store._aliases)
  const forkStores = Array.from({length: effectiveN}, () => StoreFork.createFork(store))
  const results = new Array(effectiveN)

  if (suppressedForSideEffect) {
    const result = await buildSourceCandidateResult({
      forkStore: forkStores[0],
      forkIndex: 0,
      parentNode,
      queryType,
      mcpAlias,
      rpcAlias,
      ids: foreachValidateTemplateExclusions(queryType, parentNode, store),
      signal,
      memoMap,
      suppressedForSideEffect: true,
      requestedN: n,
    })
    results[0] = result
    notifyForkSettled(onForkSettled, result)
    return results
  }

  const useSourceCandidate = admitsSourceCandidate({admitSourceCandidate, n, electNode, parentNode, store})
  const sourceCandidateIds = useSourceCandidate ? foreachValidateTemplateExclusions(queryType, parentNode, store) : []

  await Promise.allSettled(
    forkStores.map(async (forkStore, forkIndex) => {
      const forkMemoMap = new Map(memoMap)
      const result =
        useSourceCandidate && forkIndex === 0
          ? await buildSourceCandidateResult({
              forkStore,
              forkIndex,
              parentNode,
              queryType,
              mcpAlias,
              rpcAlias,
              ids: sourceCandidateIds,
              signal,
              memoMap: forkMemoMap,
              suppressedForSideEffect: false,
              requestedN: n,
            })
          : await runFreshFork({
              forkStore,
              forkIndex,
              parentNode,
              queryType,
              mcpAlias,
              rpcAlias,
              signal,
              memoMap: forkMemoMap,
              n,
            })
      results[forkIndex] = result
      notifyForkSettled(onForkSettled, result)
    }),
  )

  return results
}
/**
 * Callers use this to emit accurate fork-started counts before runForks resolves.
 * @param {NodeData} electNode
 * @param {Store} store
 * @param {number} n - Requested fork count
 * @returns {number}
 */
export function computeEffectiveN(electNode, store, n) {
  return n > 1 && isSideEffectingParent(electNode, store) ? 1 : n
}
