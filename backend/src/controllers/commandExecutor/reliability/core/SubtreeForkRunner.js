import {getNodeCommand} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {runCommand} from '../../commands/utils/runCommand'
import NullProgress from './NullProgress'
import StoreFork from './StoreFork'
import {CriteriaFailedError} from './CriteriaFailedError'
import {extractForkLeafOutputs} from './ForkLeafExtractor'
import {isSideEffectingDispatch} from './sideEffectingDispatch'
import {COMMODITY_SUPPRESSION_CAUSE} from './failureSemantics'
import {MEMO_SENTINEL_PRE_EXECUTED_CHILD} from './memoSentinels'
import {isPostProcessorOrControlQuery, hasRefineDescendant} from './refineChildPredicates'

/**
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {import('../../commands/utils/Store').default} Store
 * @typedef {import('./ForkLeafExtractor').LeafOutput} LeafOutput
 */

/**
 * @typedef {Object} ForkResult
 * @property {Store|null} forkStore  - Fork store; null for runtime-failed forks
 * @property {number} forkIndex     - Zero-based index (stable across all N results)
 * @property {'ok'|'runtime-failed'|'criteria-failed'} status
 * @property {string} [reason]      - runtime-failed only: error message
 * @property {string} [failedAt]    - criteria-failed only: criterion that exhausted retries
 * @property {number} [attempts]    - criteria-failed only: retry count attempted
 * @property {LeafOutput[]} leafOutputs - Content preview from the fork's prompt nodes; [] when none available
 * @property {boolean} [suppressed]
 * @property {string} [cause]
 * @property {number} [requestedN]
 */

function isSideEffectingParent(refineNode, store) {
  const parentNode = store.getNode(refineNode.parent)
  if (!parentNode) return false
  const command = getNodeCommand(parentNode)
  const {queryType, mcpAlias, rpcAlias} = resolveCommand(command, store._aliases)
  return isSideEffectingDispatch({queryType, mcpAlias, rpcAlias})
}

async function preExecuteSideEffectingRefineChildren(refineNode, store, memoMap, signal) {
  for (const childId of refineNode.children ?? []) {
    if (memoMap.has(childId)) continue
    const child = store.getNode(childId)
    if (!child) continue
    const query = getNodeCommand(child)
    if (isPostProcessorOrControlQuery(query)) continue
    if (hasRefineDescendant(child, store)) continue
    const {queryType, mcpAlias, rpcAlias} = resolveCommand(query, store._aliases)
    if (!queryType || !isSideEffectingDispatch({queryType, mcpAlias, rpcAlias})) continue
    await runCommand({queryType, cell: child, store, mcpAlias, rpcAlias, signal, memoMap}, new NullProgress())
    memoMap.set(childId, MEMO_SENTINEL_PRE_EXECUTED_CHILD)
  }
}

function buildPreExecFailureResults(effectiveN, err) {
  if (err instanceof CriteriaFailedError) {
    return Array.from({length: effectiveN}, (_, forkIndex) => ({
      forkStore: null,
      forkIndex,
      status: 'criteria-failed',
      failedAt: err.criterion,
      attempts: err.attempts,
      leafOutputs: [],
    }))
  }
  return Array.from({length: effectiveN}, (_, forkIndex) => ({
    forkStore: null,
    forkIndex,
    status: 'runtime-failed',
    reason: err?.message || String(err),
    leafOutputs: [],
  }))
}

/**
 * Sets `refineNode.id` in `memoMap` as `'in-progress'` BEFORE the forks run.
 * Each fork receives a fork-local memoMap copy so nested /refine cells are
 * processed independently per fork (preventing cross-fork memoization races),
 * while still containing `refineNode.id` to prevent recursive re-entry into
 * this same /refine from within each fork.
 *
 * Returns one result per executed fork, including failures — the caller decides eligibility.
 *
 * @param {{
 *   refineNode: NodeData,
 *   store: Store,
 *   n: number,
 *   memoMap: Map<string, *>,
 *   signal?: AbortSignal|null,
 *   onForkSettled?: ((result: ForkResult) => void)|null,
 * }} params
 * @returns {Promise<ForkResult[]>} one result per executed fork; never throws.
 */
export const runForks = async ({refineNode, store, n, memoMap, signal = null, onForkSettled = null}) => {
  const parentNode = store.getNode(refineNode.parent)
  if (!parentNode) {
    throw new Error(`[SubtreeForkRunner] refineNode '${refineNode.id}' has no parent in store`)
  }

  memoMap.set(refineNode.id, 'in-progress')

  const suppressedForSideEffect = n > 1 && isSideEffectingParent(refineNode, store)
  const effectiveN = suppressedForSideEffect ? 1 : n

  if (!suppressedForSideEffect && effectiveN > 1) {
    try {
      await preExecuteSideEffectingRefineChildren(refineNode, store, memoMap, signal)
    } catch (preExecErr) {
      const results = buildPreExecFailureResults(effectiveN, preExecErr)
      results.forEach(r => onForkSettled?.(r))
      return results
    }
  }

  const {queryType, mcpAlias, rpcAlias} = resolveCommand(getNodeCommand(parentNode), store._aliases)
  const forkStores = Array.from({length: effectiveN}, () => StoreFork.createFork(store))
  const results = new Array(effectiveN)

  await Promise.allSettled(
    forkStores.map(async (forkStore, forkIndex) => {
      const forkMemoMap = new Map(memoMap)
      let result
      try {
        await runCommand(
          {
            queryType,
            cell: forkStore.getNode(parentNode.id) || parentNode,
            store: forkStore,
            mcpAlias,
            rpcAlias,
            signal,
            memoMap: forkMemoMap,
          },
          new NullProgress(),
        )
        result = {
          forkStore,
          forkIndex,
          status: 'ok',
          leafOutputs: extractForkLeafOutputs(forkStore, parentNode.id),
          ...(suppressedForSideEffect
            ? {
                suppressed: true,
                cause: COMMODITY_SUPPRESSION_CAUSE.SIDE_EFFECTING_ALIAS,
                requestedN: n,
              }
            : {}),
        }
      } catch (err) {
        if (err instanceof CriteriaFailedError) {
          result = {
            forkStore,
            forkIndex,
            status: 'criteria-failed',
            failedAt: err.criterion,
            attempts: err.attempts,
            leafOutputs: extractForkLeafOutputs(forkStore, parentNode.id),
            ...(suppressedForSideEffect
              ? {
                  suppressed: true,
                  cause: COMMODITY_SUPPRESSION_CAUSE.SIDE_EFFECTING_ALIAS,
                  requestedN: n,
                }
              : {}),
          }
        } else {
          result = {
            forkStore: null,
            forkIndex,
            status: 'runtime-failed',
            reason: err?.message || String(err),
            leafOutputs: [],
            ...(suppressedForSideEffect
              ? {
                  suppressed: true,
                  cause: COMMODITY_SUPPRESSION_CAUSE.SIDE_EFFECTING_ALIAS,
                  requestedN: n,
                }
              : {}),
          }
        }
      }
      results[forkIndex] = result
      onForkSettled?.(result)
    }),
  )

  return results
}
/**
 * Callers use this to emit accurate fork-started counts before runForks resolves.
 * @param {NodeData} refineNode
 * @param {Store} store
 * @param {number} n - Requested fork count
 * @returns {number}
 */
export function computeEffectiveN(refineNode, store, n) {
  return n > 1 && isSideEffectingParent(refineNode, store) ? 1 : n
}
