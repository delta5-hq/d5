import {getNodeCommand} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {runCommand} from '../../commands/utils/runCommand'
import NullProgress from './NullProgress'
import StoreFork from './StoreFork'
import {CriteriaFailedError} from './CriteriaFailedError'

/**
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {import('../../commands/utils/Store').default} Store
 */

/**
 * @typedef {Object} ForkResult
 * @property {Store|null} forkStore - Fork store; null for runtime-failed forks
 * @property {number} forkIndex    - Zero-based index (stable across all N results)
 * @property {'ok'|'runtime-failed'|'criteria-failed'} status
 * @property {string} [reason]     - runtime-failed only: error message
 * @property {string} [failedAt]   - criteria-failed only: criterion that exhausted retries
 * @property {number} [attempts]   - criteria-failed only: retry count attempted
 */

/**
 * Run N parallel forks of the parent command for a `/refine :n=N` cell.
 *
 * Sets `refineNode.id` in `memoMap` as `'in-progress'` BEFORE the forks run.
 * Each fork receives a fork-local memoMap copy so nested /refine cells are
 * processed independently per fork (preventing cross-fork memoization races),
 * while still containing `refineNode.id` to prevent recursive re-entry into
 * this same /refine from within each fork.
 *
 * Returns ALL N fork results including failures — the caller decides eligibility.
 *
 * @param {{
 *   refineNode: NodeData,
 *   store: Store,
 *   n: number,
 *   memoMap: Map<string, *>,
 *   signal?: AbortSignal|null,
 * }} params
 * @returns {Promise<ForkResult[]>} Exactly N results; never throws.
 */
export const runForks = async ({refineNode, store, n, memoMap, signal = null}) => {
  const parentNode = store.getNode(refineNode.parent)
  if (!parentNode) {
    throw new Error(`[SubtreeForkRunner] refineNode '${refineNode.id}' has no parent in store`)
  }

  memoMap.set(refineNode.id, 'in-progress')

  const command = getNodeCommand(parentNode)
  const {queryType, mcpAlias, rpcAlias} = resolveCommand(command, store._aliases)

  const forkStores = Array.from({length: n}, () => StoreFork.createFork(store))

  const settled = await Promise.allSettled(
    forkStores.map(async (forkStore, forkIndex) => {
      // Each fork gets its own memoMap copy so nested /refine cells resolve
      // independently in each fork (not shared across concurrent siblings).
      // refineNode.id is already 'in-progress' in the copy, preventing recursion.
      const forkMemoMap = new Map(memoMap)
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
      return {forkStore, forkIndex, status: 'ok'}
    }),
  )

  return settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const err = r.reason
    if (err instanceof CriteriaFailedError) {
      return {
        forkStore: forkStores[i],
        forkIndex: i,
        status: 'criteria-failed',
        failedAt: err.criterion,
        attempts: err.attempts,
      }
    }
    return {
      forkStore: null,
      forkIndex: i,
      status: 'runtime-failed',
      reason: err?.message || String(err),
    }
  })
}
