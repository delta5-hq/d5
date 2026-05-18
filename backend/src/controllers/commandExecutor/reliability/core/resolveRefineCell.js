import StoreFork from './StoreFork'
import {runForks} from './SubtreeForkRunner'
import {ForkJudge} from './ForkJudge'
import OwnershipResolver from './OwnershipResolver'
import {readRefineN, readFallbackFlag} from './refineParams'
import {projectForkCost} from './forkCostProjector'
import {readForkLimit, exceedsForkLimit, forkLimitRefusalMessage} from './forkLimitParser'
import {appendRefineSuffix, stripReliabilitySuffix} from './reliabilitySuffix'
import {getNodeCommand} from '../../commands/utils/isCommand'

/**
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {import('../../commands/utils/Store').default} Store
 */

function writeErrorNode(refineNode, store, message) {
  refineNode.title = stripReliabilitySuffix(refineNode.title || '')
  store.importer.createErrorNode(message, refineNode.id)
  store.saveNodeToOutput(refineNode.id)
}

/**
 * @param {NodeData} refineNode
 * @param {Store} store
 * @param {Map<string,*>} memoMap
 * @param {AbortSignal|null} [signal]
 */
export async function resolveRefineCell(refineNode, store, memoMap, signal = null) {
  const query = getNodeCommand(refineNode)
  const n = readRefineN(query)

  if (!n) {
    writeErrorNode(refineNode, store, 'Error: /refine requires :n=N (e.g. /refine :n=3)')
    return
  }

  const cost = projectForkCost(refineNode, store)
  const limit = readForkLimit(query)
  if (exceedsForkLimit(cost, limit)) {
    writeErrorNode(refineNode, store, forkLimitRefusalMessage(cost, limit))
    return
  }

  const fallback = readFallbackFlag(query)
  memoMap.set(refineNode.id, 'in-progress')

  const ownerMap = OwnershipResolver(refineNode, store)
  const ownedValidates = ownerMap.get(refineNode.id) ?? []

  const forkResults = await runForks({refineNode, store, n, memoMap, signal})

  const judge = new ForkJudge(store._userId, store._workflowId, store)
  const verdict = await judge.selectWinner({
    forks: forkResults,
    validateNodes: ownedValidates,
    parentNodeId: refineNode.parent,
    fallback,
    signal,
  })

  const okCount = forkResults.filter(f => f.status === 'ok').length
  const baseTitle = stripReliabilitySuffix(refineNode.title || '')

  if (!verdict || verdict.winnerForkIndex === null) {
    refineNode.title = appendRefineSuffix(baseTitle, {eligible: okCount, total: n, fallback, winnerForkIndex: null})
    store.importer.createErrorNode(
      `/refine :n=${n} — all ${n} fork(s) failed; use :fallback to accept best degraded result`,
      refineNode.id,
    )
    store.saveNodeToOutput(refineNode.id)
    memoMap.set(refineNode.id, null)
    return
  }

  const winnerFork = forkResults.find(f => f.forkIndex === verdict.winnerForkIndex)
  StoreFork.applyCandidate(store, winnerFork.forkStore, refineNode.id)

  const winnerNode = store.getNode(refineNode.id)
  if (winnerNode) {
    winnerNode.title = appendRefineSuffix(baseTitle, {
      eligible: okCount,
      total: n,
      fallback: verdict.selectionLayer === 'fallback',
      winnerForkIndex: verdict.winnerForkIndex,
      noSignal: verdict.noSignal ?? false,
    })
    winnerNode.reliabilityMetadata = {
      winnerForkIndex: verdict.winnerForkIndex,
      perCriterionVerdict: verdict.perCriterionVerdict ?? [],
      mode: verdict.mode,
      selectionLayer: verdict.selectionLayer,
      noSignal: verdict.noSignal ?? false,
      eligible: okCount,
      total: n,
    }
    store.saveNodeToOutput(refineNode.id)
  }

  memoMap.set(refineNode.id, winnerFork.forkStore)
}
