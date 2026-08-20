import StoreFork from './StoreFork'
import {runForks} from './SubtreeForkRunner'
import {ForkJudge} from './ForkJudge'
import OwnershipResolver from './OwnershipResolver'
import {readRefineN, readRawRefineN, readFallbackFlag, readJudgeReasoningFlag} from './refineParams'
import {projectForkCost} from './forkCostProjector'
import {readForkLimit, exceedsForkLimit, forkLimitRefusalMessage} from './forkLimitParser'
import {appendRefineSuffix, appendInvalidSuffix, stripReliabilitySuffix} from './reliabilitySuffix'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell} from './validateParams'
import {NullForkProgressEmitter} from './ForkProgressEmitter'
import {buildReliabilityMetadata, buildSuppressedReliabilityMetadata} from './reliabilityMetadataFields'
import {copyParentPromptOutputToRefine} from './refineWinnerOutput'

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
export async function resolveRefineCell(
  refineNode,
  store,
  memoMap,
  signal = null,
  emitter = new NullForkProgressEmitter(),
) {
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
  const judgeReasoningRequested = readJudgeReasoningFlag(query)
  memoMap.set(refineNode.id, 'in-progress')

  emitter.forksStarted(refineNode.id, n)

  const ownerMap = OwnershipResolver(refineNode, store)
  const ownedValidates = ownerMap.get(refineNode.id) ?? []

  const refineParentNode = store.getNode(refineNode.parent)
  const siblingValidates = (refineParentNode?.children ?? [])
    .filter(id => id !== refineNode.id)
    .map(id => store.getNode(id))
    .filter(n => n && isValidateCell(getNodeCommand(n)))
  const allValidates = [...ownedValidates, ...siblingValidates]

  const forkResults = await runForks({
    refineNode,
    store,
    n,
    memoMap,
    signal,
    onForkSettled: result => emitter.forkSettled(refineNode.id, result),
  })

  const okCount = forkResults.filter(f => f.status === 'ok').length
  const baseTitle = stripReliabilitySuffix(refineNode.title || '')

  const suppressedFork = forkResults.find(f => f.suppressed)
  if (suppressedFork) {
    const singleFork = forkResults[0]
    if (singleFork?.forkStore) {
      StoreFork.applyCandidate(store, singleFork.forkStore, refineNode.id)
      copyParentPromptOutputToRefine({
        sourceStore: singleFork.forkStore,
        targetStore: store,
        parentNodeId: refineNode.parent,
        refineNodeId: refineNode.id,
      })
      flushValidateTitles(allValidates, singleFork.forkStore, store)
    }
    const winnerNode = store.getNode(refineNode.id)
    if (winnerNode) {
      winnerNode.title = appendRefineSuffix(baseTitle, {eligible: 1, total: 1, winnerForkIndex: 0})
      winnerNode.reliabilityMetadata = buildSuppressedReliabilityMetadata({
        cause: suppressedFork.cause,
        requestedN: suppressedFork.requestedN,
      })
      store.saveNodeToOutput(refineNode.id)
    }
    emitter.refineComplete(refineNode.id, 0, 1)
    memoMap.set(refineNode.id, singleFork?.forkStore ?? null)
    return
  }

  const judge = new ForkJudge(store._userId, store._workflowId, store)
  const verdict = await judge.selectWinner({
    forks: forkResults,
    validateNodes: allValidates,
    parentNodeId: refineNode.parent,
    fallback,
    signal,
    judgeReasoningRequested,
  })

  if (!verdict || verdict.winnerForkIndex === null) {
    const suffixEligible = verdict?.allGateFiltered ? 0 : okCount
    refineNode.title = appendRefineSuffix(baseTitle, {
      eligible: suffixEligible,
      total: n,
      fallback,
      winnerForkIndex: null,
      noSignal: verdict?.noSignal ?? false,
    })
    if (verdict) {
      refineNode.reliabilityMetadata = buildReliabilityMetadata(verdict, forkResults, okCount, n)
    }
    store.importer.createErrorNode(
      verdict?.allGateFiltered
        ? `/refine :n=${n} — all ${n} fork(s) produced empty or refusal output; revise the prompt`
        : `/refine :n=${n} — all ${n} fork(s) failed; use :fallback to accept best degraded result`,
      refineNode.id,
    )
    store.saveNodeToOutput(refineNode.id)
    const diagnosticFork = forkResults.find(f => f.status === 'criteria-failed' && f.forkStore)
    if (diagnosticFork) {
      flushValidateTitles(allValidates, diagnosticFork.forkStore, store)
    }
    emitter.refineComplete(refineNode.id, null, n)
    memoMap.set(refineNode.id, null)
    return
  }

  const winnerFork = forkResults.find(f => f.forkIndex === verdict.winnerForkIndex)
  if (!winnerFork?.forkStore) {
    refineNode.title = appendRefineSuffix(baseTitle, {
      eligible: okCount,
      total: n,
      fallback,
      winnerForkIndex: null,
      noSignal: false,
    })
    store.importer.createErrorNode(`/refine :n=${n} — winner fork has no store (internal error)`, refineNode.id)
    store.saveNodeToOutput(refineNode.id)
    emitter.refineComplete(refineNode.id, null, n)
    memoMap.set(refineNode.id, null)
    return
  }
  StoreFork.applyCandidate(store, winnerFork.forkStore, refineNode.id)
  copyParentPromptOutputToRefine({
    sourceStore: winnerFork.forkStore,
    targetStore: store,
    parentNodeId: refineNode.parent,
    refineNodeId: refineNode.id,
  })

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
      degradedInput: verdict.judgeInput?.degradedInput ?? false,
    })
    winnerNode.reliabilityMetadata = buildReliabilityMetadata(verdict, forkResults, okCount, n)
    store.saveNodeToOutput(refineNode.id)
  }

  emitter.refineComplete(refineNode.id, verdict.winnerForkIndex, n, {
    fallbackUsed: verdict.selectionLayer === 'fallback',
    generatorOnlyJudge: verdict.generatorOnlyJudge ?? false,
    judgeReasoningRequested: verdict.judgeReasoningRequested ?? false,
  })
  memoMap.set(refineNode.id, winnerFork.forkStore)
}
