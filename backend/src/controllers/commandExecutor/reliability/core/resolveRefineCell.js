import StoreFork from './StoreFork'
import {runForks} from './SubtreeForkRunner'
import {ForkJudge} from './ForkJudge'
import OwnershipResolver from './OwnershipResolver'
import {readRefineN, readRawRefineN, readFallbackFlag} from './refineParams'
import {projectForkCost} from './forkCostProjector'
import {readForkLimit, exceedsForkLimit, forkLimitRefusalMessage} from './forkLimitParser'
import {appendRefineSuffix, appendInvalidSuffix, stripReliabilitySuffix} from './reliabilitySuffix'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell} from './validateParams'

/**
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {import('../../commands/utils/Store').default} Store
 */

function writeErrorNode(refineNode, store, message) {
  refineNode.title = appendInvalidSuffix(refineNode.title || '')
  store.importer.createErrorNode(message, refineNode.id)
  store.saveNodeToOutput(refineNode.id)
}

function missingNErrorMessage(rawN) {
  if (rawN !== null) {
    return `Error: /refine :n=${rawN} is a no-op — minimum is :n=2`
  }
  return 'Error: /refine requires :n=N (e.g. /refine :n=3)'
}

function flushValidateTitles(validates, sourceForkStore, outerStore) {
  for (const validateNode of validates) {
    const forkValidate = sourceForkStore.getNode(validateNode.id)
    const targetValidate = outerStore.getNode(validateNode.id)
    if (forkValidate && targetValidate) {
      targetValidate.title = forkValidate.title
      targetValidate.reliabilityMetadata = forkValidate.reliabilityMetadata
      outerStore.saveNodeToOutput(validateNode.id)
    }
  }
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
    writeErrorNode(refineNode, store, missingNErrorMessage(readRawRefineN(query)))
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

  const refineParentNode = store.getNode(refineNode.parent)
  const siblingValidates = (refineParentNode?.children ?? [])
    .filter(id => id !== refineNode.id)
    .map(id => store.getNode(id))
    .filter(n => n && isValidateCell(getNodeCommand(n)))
  const allValidates = [...ownedValidates, ...siblingValidates]

  const forkResults = await runForks({refineNode, store, n, memoMap, signal})

  const judge = new ForkJudge(store._userId, store._workflowId, store)
  const verdict = await judge.selectWinner({
    forks: forkResults,
    validateNodes: allValidates,
    parentNodeId: refineNode.parent,
    fallback,
    signal,
  })

  const okCount = forkResults.filter(f => f.status === 'ok').length
  const baseTitle = stripReliabilitySuffix(refineNode.title || '')

  if (!verdict || verdict.winnerForkIndex === null) {
    refineNode.title = appendRefineSuffix(baseTitle, {
      eligible: okCount,
      total: n,
      fallback,
      winnerForkIndex: null,
      noSignal: verdict?.noSignal ?? false,
    })
    store.importer.createErrorNode(
      `/refine :n=${n} — all ${n} fork(s) failed; use :fallback to accept best degraded result`,
      refineNode.id,
    )
    store.saveNodeToOutput(refineNode.id)
    // so the user can attribute which criterion caused the failure
    const diagnosticFork = forkResults.find(f => f.status === 'criteria-failed' && f.forkStore)
    if (diagnosticFork) {
      flushValidateTitles(allValidates, diagnosticFork.forkStore, store)
    }
    memoMap.set(refineNode.id, null)
    return
  }

  const winnerFork = forkResults.find(f => f.forkIndex === verdict.winnerForkIndex)
  StoreFork.applyCandidate(store, winnerFork.forkStore, refineNode.id)

  // Sibling validates are outside the refine subtree — applyCandidate does not transfer their titles.
  flushValidateTitles(allValidates, winnerFork.forkStore, store)

  const winnerNode = store.getNode(refineNode.id)
  if (winnerNode) {
    winnerNode.title = appendRefineSuffix(baseTitle, {
      eligible: okCount,
      total: n,
      fallback: verdict.selectionLayer === 'fallback',
      winnerForkIndex: verdict.winnerForkIndex,
      noSignal: !fallback && (verdict.noSignal ?? false),
    })
    winnerNode.reliabilityMetadata = {
      winnerForkIndex: verdict.winnerForkIndex,
      perCriterionVerdict: verdict.perCriterionVerdict ?? [],
      mode: verdict.mode,
      selectionLayer: verdict.selectionLayer,
      noSignal: verdict.noSignal ?? false,
      tiebreakUsed: verdict.tiebreakUsed ?? false,
      eligible: okCount,
      total: n,
      judgeQualityWarnings: verdict.judgeQualityWarnings ?? [],
    }
    store.saveNodeToOutput(refineNode.id)
  }

  memoMap.set(refineNode.id, winnerFork.forkStore)
}
