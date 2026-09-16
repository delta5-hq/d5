import {getNodeCommand} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {foreachValidateTemplateExclusions, postProcessExistingOutput, runCommand} from '../../commands/utils/runCommand'
import NullProgress from './NullProgress'
import StoreFork from './StoreFork'
import {CriteriaFailedError} from './CriteriaFailedError'
import {extractForkLeafOutputs} from './ForkLeafExtractor'
import {admitsSourceCandidate} from './sourceCandidateAdmission'
import {mountTermInFork, mountSequencingTermInFork} from './forkTermMount'
import {gateOnValidateGroup} from './validateGroup'
import {isValidateCell} from './validateParams'
import {STEPS_QUERY_TYPE} from '../../constants/steps'

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
 * @property {string} [reason]      - runtime failure or criteria-failed rejection reason
 * @property {string} [failedAt]    - criteria-failed only: criterion that exhausted retries
 * @property {number} [attempts]    - criteria-failed only: retry count attempted
 * @property {LeafOutput[]} leafOutputs - Content preview from the fork's prompt nodes; [] when none available
 */

function buildOkResult({forkStore, forkIndex, parentNodeId}) {
  return {
    forkStore,
    forkIndex,
    status: 'ok',
    leafOutputs: extractForkLeafOutputs(forkStore, parentNodeId),
  }
}

function buildCriteriaFailedResult({forkStore, forkIndex, parentNodeId, error}) {
  return {
    forkStore,
    forkIndex,
    status: 'criteria-failed',
    failedAt: error.criterion,
    attempts: error.attempts,
    reason: error.reason,
    leafOutputs: extractForkLeafOutputs(forkStore, parentNodeId),
  }
}

function buildRuntimeFailedResult({forkIndex, error}) {
  return {
    forkStore: null,
    forkIndex,
    status: 'runtime-failed',
    reason: error?.message || String(error),
    leafOutputs: [],
  }
}

function buildFailureResult({forkStore = null, forkIndex, parentNodeId = null, error}) {
  if (error instanceof CriteriaFailedError) {
    return buildCriteriaFailedResult({forkStore, forkIndex, parentNodeId, error})
  }
  return buildRuntimeFailedResult({forkIndex, error})
}

function notifyForkSettled(onForkSettled, result) {
  onForkSettled?.(result)
}

async function settleParallelForks(forkStores, onForkSettled, runOneFork) {
  const results = new Array(forkStores.length)
  await Promise.allSettled(
    forkStores.map(async (forkStore, forkIndex) => {
      const result = await runOneFork(forkStore, forkIndex)
      results[forkIndex] = result
      notifyForkSettled(onForkSettled, result)
    }),
  )
  return results
}

// A /steps term runs its subtree with post-processing off, so the elect's assertion children are not
// gated by the ordinary post-process path. Applying the shared validate gate here rejects a fork whose
// sequenced output fails a criterion, exactly as a single-command term's post-processing would.
async function gateSequencingCandidate(forkStore, validateIds, signal) {
  if (validateIds.length === 0) return
  const validates = validateIds.map(id => forkStore.getNode(id)).filter(Boolean)
  await gateOnValidateGroup(validates, forkStore, signal)
}

async function runFreshFork({
  forkStore,
  forkIndex,
  parentNode,
  queryType,
  mcpAlias,
  rpcAlias,
  signal,
  memoMap,
  gateValidateIds,
}) {
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
    await gateSequencingCandidate(forkStore, gateValidateIds, signal)
    return buildOkResult({forkStore, forkIndex, parentNodeId: parentNode.id})
  } catch (err) {
    return buildFailureResult({forkStore, forkIndex, parentNodeId: parentNode.id, error: err})
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
  gateValidateIds,
}) {
  try {
    await postProcessExistingOutput({
      node: forkStore.getNode(parentNode.id),
      ids,
      store: forkStore,
      progress: new NullProgress(),
      signal,
      memoMap: new Map(memoMap),
      cell: forkStore.getNode(parentNode.id) || parentNode,
      queryType,
      mcpAlias,
      rpcAlias,
    })
    await gateSequencingCandidate(forkStore, gateValidateIds, signal)
    return buildOkResult({forkStore, forkIndex, parentNodeId: parentNode.id})
  } catch (err) {
    return buildFailureResult({forkStore, forkIndex, parentNodeId: parentNode.id, error: err})
  }
}

// Inline elects wrap their term in a synthetic parent; mounting it into each disposable fork
// keeps the outer store pristine. Postfix elects have a real parent and mount nothing.
function resolveParentNode(electNode, store, termParent) {
  return termParent ?? store.getNode(electNode.parent)
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
 *   termParent?: NodeData|null,
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
  termParent = null,
}) => {
  const parentNode = resolveParentNode(electNode, store, termParent)
  if (!parentNode) {
    throw new Error(`[SubtreeForkRunner] electNode '${electNode.id}' has no parent in store`)
  }

  memoMap.set(electNode.id, 'in-progress')

  const {queryType, mcpAlias, rpcAlias} = resolveCommand(getNodeCommand(parentNode), store._aliases)
  const forkStores = Array.from({length: n}, () => StoreFork.createFork(store))
  if (termParent) {
    const mount =
      queryType === STEPS_QUERY_TYPE
        ? forkStore => mountSequencingTermInFork(forkStore, termParent, electNode.id, electNode.parent)
        : forkStore => mountTermInFork(forkStore, termParent, electNode.id, electNode.parent)
    forkStores.forEach(mount)
  }

  const useSourceCandidate = admitsSourceCandidate({admitSourceCandidate, n, parentNode, store})
  const sourceCandidateIds = useSourceCandidate ? foreachValidateTemplateExclusions(queryType, parentNode, store) : []

  const gateValidateIds =
    queryType === STEPS_QUERY_TYPE
      ? (electNode.children ?? []).filter(id => {
          const child = store.getNode(id)
          return child && isValidateCell(getNodeCommand(child))
        })
      : []

  return settleParallelForks(forkStores, onForkSettled, (forkStore, forkIndex) => {
    const forkMemoMap = new Map(memoMap)
    return useSourceCandidate && forkIndex === 0
      ? buildSourceCandidateResult({
          forkStore,
          forkIndex,
          parentNode,
          queryType,
          mcpAlias,
          rpcAlias,
          ids: sourceCandidateIds,
          signal,
          memoMap: forkMemoMap,
          gateValidateIds,
        })
      : runFreshFork({
          forkStore,
          forkIndex,
          parentNode,
          queryType,
          mcpAlias,
          rpcAlias,
          signal,
          memoMap: forkMemoMap,
          gateValidateIds,
        })
  })
}
