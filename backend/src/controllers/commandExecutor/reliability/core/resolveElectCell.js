import StoreFork from './StoreFork'
import {runForks, computeEffectiveN} from './SubtreeForkRunner'
import {ForkJudge} from './ForkJudge'
import OwnershipResolver from './OwnershipResolver'
import {readElectN, readRawElectN, readFallbackFlag, readJudgeReasoningFlag, readElectTrailingText} from './electParams'
import {projectForkCost} from './forkCostProjector'
import {readForkLimit, exceedsForkLimit, forkLimitRefusalMessage} from './forkLimitParser'
import {appendElectSuffix, appendInvalidSuffix, stripReliabilitySuffix} from './reliabilitySuffix'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell} from './validateParams'
import {NullForkProgressEmitter} from './ForkProgressEmitter'
import {buildReliabilityMetadata, buildSuppressedReliabilityMetadata} from './reliabilityMetadataFields'
import {classifyNoWinner} from './failureSemantics'
import {copyParentPromptOutputToElect} from './electWinnerOutput'

/**
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {import('../../commands/utils/Store').default} Store
 */

function writeErrorNode(electNode, store, message) {
  electNode.title = appendInvalidSuffix(electNode.title || '')
  store.importer.createErrorNode(message, electNode.id)
  store.saveNodeToOutput(electNode.id)
}

function missingNErrorMessage(rawN) {
  if (rawN !== null) {
    return `Error: /elect :n=${rawN} is a no-op — minimum is :n=2`
  }
  return 'Error: /elect requires :n=N (e.g. /elect :n=3)'
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

function flushNestedReliabilityDiagnostics(rootNode, sourceForkStore, outerStore) {
  const stack = [...(rootNode.children ?? [])]
  while (stack.length > 0) {
    const nodeId = stack.pop()
    const sourceNode = sourceForkStore.getNode(nodeId)
    if (!sourceNode) continue
    stack.push(...(sourceNode.children ?? []).filter(id => !(sourceNode.prompts ?? []).includes(id)))
    const mode = sourceNode.reliabilityMetadata?.mode
    if (!['validate', 'refine', 'invalid', 'suppressed'].includes(mode)) continue
    const targetNode = outerStore.getNode(nodeId)
    if (!targetNode) continue
    targetNode.title = sourceNode.title
    targetNode.reliabilityMetadata = sourceNode.reliabilityMetadata
    outerStore.saveNodeToOutput(nodeId)
  }
}

/**
 * @param {NodeData} electNode
 * @param {Store} store
 * @param {Map<string,*>} memoMap
 * @param {AbortSignal|null} [signal]
 */
export async function resolveElectCell(
  electNode,
  store,
  memoMap,
  signal = null,
  emitter = new NullForkProgressEmitter(),
) {
  const query = getNodeCommand(electNode)
  const n = readElectN(query)
  const trailingText = readElectTrailingText(query)

  if (trailingText) {
    writeErrorNode(
      electNode,
      store,
      `Error: /elect does not accept criterion text; add a sibling /validate cell instead (unexpected: "${trailingText}")`,
    )
    return
  }

  if (!n) {
    writeErrorNode(electNode, store, missingNErrorMessage(readRawElectN(query)))
    return
  }

  const cost = projectForkCost(electNode, store)
  const limit = readForkLimit(query)
  if (exceedsForkLimit(cost, limit)) {
    writeErrorNode(electNode, store, forkLimitRefusalMessage(cost, limit))
    return
  }

  const fallback = readFallbackFlag(query)
  const judgeReasoningRequested = readJudgeReasoningFlag(query)
  memoMap.set(electNode.id, 'in-progress')

  const effectiveN = computeEffectiveN(electNode, store, n)
  emitter.forksStarted(electNode.id, effectiveN)

  const ownerMap = OwnershipResolver(electNode, store)
  const ownedValidates = ownerMap.get(electNode.id) ?? []

  const electParentNode = store.getNode(electNode.parent)
  const siblingValidates = (electParentNode?.children ?? [])
    .filter(id => id !== electNode.id)
    .map(id => store.getNode(id))
    .filter(n => n && isValidateCell(getNodeCommand(n)))
  const allValidates = [...ownedValidates, ...siblingValidates]

  const forkResults = await runForks({
    electNode,
    store,
    n,
    memoMap,
    signal,
    onForkSettled: result => emitter.forkSettled(electNode.id, result),
  })

  const okCount = forkResults.filter(f => f.status === 'ok').length
  const baseTitle = stripReliabilitySuffix(electNode.title || '')

  const suppressedFork = forkResults.find(f => f.suppressed)
  if (suppressedFork) {
    const singleFork = forkResults[0]
    if (singleFork?.status === 'ok') {
      if (singleFork.forkStore) {
        StoreFork.applyCandidate(store, singleFork.forkStore, electNode.id)
        copyParentPromptOutputToElect({
          sourceStore: singleFork.forkStore,
          targetStore: store,
          parentNodeId: electNode.parent,
          electNodeId: electNode.id,
        })
        flushValidateTitles(allValidates, singleFork.forkStore, store)
      }
      const winnerNode = store.getNode(electNode.id)
      if (winnerNode) {
        winnerNode.title = appendElectSuffix(baseTitle, {
          eligible: 1,
          total: 1,
          winnerForkIndex: 0,
        })
        winnerNode.reliabilityMetadata = buildSuppressedReliabilityMetadata({
          cause: suppressedFork.cause,
          requestedN: suppressedFork.requestedN,
        })
        store.saveNodeToOutput(electNode.id)
      }
      emitter.electComplete(electNode.id, 0, 1)
      memoMap.set(electNode.id, singleFork.forkStore ?? null)
    } else {
      const winnerNode = store.getNode(electNode.id)
      if (winnerNode) {
        winnerNode.title = appendElectSuffix(baseTitle, {
          eligible: 0,
          total: 1,
          winnerForkIndex: null,
        })
        const {failureCause, remediationHint} = classifyNoWinner({
          forkResults: [singleFork],
        })
        winnerNode.reliabilityMetadata = buildSuppressedReliabilityMetadata({
          cause: suppressedFork.cause,
          requestedN: suppressedFork.requestedN,
          eligible: 0,
          total: 1,
          failureCause,
          remediationHint,
        })
        store.saveNodeToOutput(electNode.id)
      }
      store.importer.createErrorNode(
        `/elect :n=${suppressedFork.requestedN ?? n} — the single suppressed run failed`,
        electNode.id,
      )
      emitter.electComplete(electNode.id, null, 1)
      memoMap.set(electNode.id, null)
    }
    return
  }

  const judge = new ForkJudge(store._userId, store._workflowId, store)
  const verdict = await judge.selectWinner({
    forks: forkResults,
    validateNodes: allValidates,
    parentNodeId: electNode.parent,
    fallback,
    signal,
    judgeReasoningRequested,
  })

  if (!verdict || verdict.winnerForkIndex === null) {
    const suffixEligible = verdict?.allGateFiltered ? 0 : okCount
    const diagnosticFork = forkResults.find(f => f.status === 'criteria-failed' && f.forkStore)
    if (diagnosticFork) {
      // Preserve modifier diagnostics only. Strict /elect still selects no failed
      // candidate and therefore never transfers generated output without :fallback.
      flushNestedReliabilityDiagnostics(electNode, diagnosticFork.forkStore, store)
      flushValidateTitles(allValidates, diagnosticFork.forkStore, store)
    }
    const currentElect = store.getNode(electNode.id) ?? electNode
    currentElect.title = appendElectSuffix(baseTitle, {
      eligible: suffixEligible,
      total: effectiveN,
      fallback,
      winnerForkIndex: null,
      noSignal: verdict?.noSignal ?? false,
    })
    if (verdict) {
      currentElect.reliabilityMetadata = buildReliabilityMetadata(verdict, forkResults, okCount, n)
    }
    store.importer.createErrorNode(
      verdict?.allGateFiltered
        ? `/elect :n=${effectiveN} — all ${effectiveN} fork(s) produced empty or refusal output; revise the prompt`
        : `/elect :n=${effectiveN} — all ${effectiveN} fork(s) failed; use :fallback to accept best degraded result`,
      currentElect.id,
    )
    store.saveNodeToOutput(currentElect.id)
    emitter.electComplete(electNode.id, null, effectiveN)
    memoMap.set(electNode.id, null)
    return
  }

  const winnerFork = forkResults.find(f => f.forkIndex === verdict.winnerForkIndex)
  if (!winnerFork?.forkStore) {
    electNode.title = appendElectSuffix(baseTitle, {
      eligible: okCount,
      total: effectiveN,
      fallback,
      winnerForkIndex: null,
      noSignal: false,
    })
    store.importer.createErrorNode(`/elect :n=${effectiveN} — winner fork has no store (internal error)`, electNode.id)
    store.saveNodeToOutput(electNode.id)
    emitter.electComplete(electNode.id, null, effectiveN)
    memoMap.set(electNode.id, null)
    return
  }
  StoreFork.applyCandidate(store, winnerFork.forkStore, electNode.id)
  copyParentPromptOutputToElect({
    sourceStore: winnerFork.forkStore,
    targetStore: store,
    parentNodeId: electNode.parent,
    electNodeId: electNode.id,
  })

  // Sibling validates are outside the elect subtree — applyCandidate does not transfer their titles.
  flushValidateTitles(allValidates, winnerFork.forkStore, store)

  const winnerNode = store.getNode(electNode.id)
  if (winnerNode) {
    winnerNode.title = appendElectSuffix(baseTitle, {
      eligible: okCount,
      total: effectiveN,
      fallback: verdict.selectionLayer === 'fallback',
      winnerForkIndex: verdict.winnerForkIndex,
      noSignal: !fallback && (verdict.noSignal ?? false),
      degradedInput: verdict.judgeInput?.degradedInput ?? false,
    })
    winnerNode.reliabilityMetadata = buildReliabilityMetadata(verdict, forkResults, okCount, n)
    store.saveNodeToOutput(electNode.id)
  }

  emitter.electComplete(electNode.id, verdict.winnerForkIndex, effectiveN, {
    fallbackUsed: verdict.selectionLayer === 'fallback',
    generatorOnlyJudge: verdict.generatorOnlyJudge ?? false,
    judgeReasoningRequested: verdict.judgeReasoningRequested ?? false,
  })
  memoMap.set(electNode.id, winnerFork.forkStore)
}
