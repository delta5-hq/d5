import StoreFork from './StoreFork'
import {runForks} from './SubtreeForkRunner'
import {ForkJudge} from './ForkJudge'
import OwnershipResolver from './OwnershipResolver'
import {readElectN, readRawElectN, readFallbackFlag, readJudgeReasoningFlag, readElectTrailingText} from './electParams'
import {parseInlineTerm, buildSyntheticTermParent} from './inlineTermParser'
import {projectForkCost} from './forkCostProjector'
import {readForkLimit, exceedsForkLimit, forkLimitRefusalMessage} from './forkLimitParser'
import {appendElectSuffix, appendInvalidSuffix, stripReliabilitySuffix} from './reliabilitySuffix'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {clearStepsPrefix, STEPS_QUERY_TYPE} from '../../constants/steps'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {isValidateCell} from './validateParams'
import {NullForkProgressEmitter} from './ForkProgressEmitter'
import {buildReliabilityMetadata} from './reliabilityMetadataFields'
import {FAILURE_CAUSE} from './failureSemantics'
import {copyParentPromptOutputToElect} from './electWinnerOutput'
import {firstInadmissibleInlineTermChild, inlineTermChildRefusalMessage} from './inlineTermChildAdmission'
import {
  commandIsExternalDispatch,
  dispatchIsExternal,
  externalDispatchRefusalMessage,
  buildExternalDispatchRefusalMetadata,
} from './externalDispatchRefusal'

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

function gateFilteredErrorMessage(n, forkResults) {
  const gateRejected = forkResults.filter(f => f.status === 'ok')
  const reasons = gateRejected.map(f => `fork ${f.forkIndex}: ${f.reason || FAILURE_CAUSE.STRUCTURAL_GATE}`).join('; ')
  const judgedCount = gateRejected.length
  return `/elect :n=${n} — all ${judgedCount} candidate(s) were structurally rejected: ${reasons}`
}

// The fork copied the elect node with its fork-local parent (the synthetic term); restore the
// real ancestor so the outer tree stays consistent and the cell is never seen as orphaned.
function reattachWinnerToAncestor(store, electId, ancestorId) {
  const winner = store.getNode(electId)
  if (winner) winner.parent = ancestorId
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
    if (!['validate', 'refine', 'invalid'].includes(mode)) continue
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
  admitSourceCandidate = false,
) {
  // Strip any #N order prefix so an elect used as a /steps step reads its params from the
  // bare modifier; the node title keeps the prefix for ordering and display.
  const query = clearStepsPrefix(getNodeCommand(electNode))
  const n = readElectN(query)
  const trailingText = readElectTrailingText(query)
  const inlineTerm = parseInlineTerm(trailingText, store._aliases)
  const trailingIsExternalDispatch = commandIsExternalDispatch(trailingText, store)

  // An `/mcp:`/`/rpc:`-shaped term is an external dispatch, refused below by its shape alone even
  // when the alias is unconfigured; it is never the criterion text this branch rejects.
  if (trailingText && !inlineTerm && !trailingIsExternalDispatch) {
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

  const originalParentId = electNode.parent
  const admitScopeSourceCandidate = inlineTerm ? false : admitSourceCandidate
  const termParent = inlineTerm ? buildSyntheticTermParent(electNode.id, inlineTerm, originalParentId) : null
  const contentSourceId = termParent ? termParent.id : originalParentId

  const dispatchNode = termParent ?? store.getNode(originalParentId)
  if (trailingIsExternalDispatch || dispatchIsExternal(dispatchNode, store)) {
    electNode.title = appendInvalidSuffix(electNode.title || '')
    electNode.reliabilityMetadata = buildExternalDispatchRefusalMetadata(n)
    store.importer.createErrorNode(externalDispatchRefusalMessage('/elect', n), electNode.id)
    store.saveNodeToOutput(electNode.id)
    memoMap.set(electNode.id, null)
    return
  }

  const termIsSequencing =
    inlineTerm && resolveCommand(clearStepsPrefix(inlineTerm), store._aliases).queryType === STEPS_QUERY_TYPE
  if (inlineTerm && !termIsSequencing) {
    const inadmissible = firstInadmissibleInlineTermChild(electNode, store)
    if (inadmissible) {
      writeErrorNode(electNode, store, inlineTermChildRefusalMessage('/elect', getNodeCommand(inadmissible)))
      return
    }
  }

  const cost = projectForkCost(electNode, store, admitScopeSourceCandidate, termParent)
  const limit = readForkLimit(query)
  if (exceedsForkLimit(cost, limit)) {
    writeErrorNode(electNode, store, forkLimitRefusalMessage(cost, limit))
    return
  }

  const fallback = readFallbackFlag(query)
  const judgeReasoningRequested = readJudgeReasoningFlag(query)
  memoMap.set(electNode.id, 'in-progress')

  emitter.forksStarted(electNode.id, n)

  const ownerMap = OwnershipResolver(electNode, store)
  const ownedValidates = ownerMap.get(electNode.id) ?? []

  const electParentNode = store.getNode(originalParentId)
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
    admitSourceCandidate: admitScopeSourceCandidate,
    termParent,
  })

  const okCount = forkResults.filter(f => f.status === 'ok').length
  const baseTitle = stripReliabilitySuffix(electNode.title || '')

  const judge = new ForkJudge(store._userId, store._workflowId, store)
  const verdict = await judge.selectWinner({
    forks: forkResults,
    validateNodes: allValidates,
    parentNodeId: contentSourceId,
    fallback,
    signal,
    judgeReasoningRequested,
  })

  if (!verdict || verdict.winnerForkIndex === null) {
    const eligibleCount = verdict?.allGateFiltered ? 0 : okCount
    const diagnosticFork = forkResults.find(f => f.status === 'criteria-failed' && f.forkStore)
    if (diagnosticFork) {
      // Preserve modifier diagnostics only. Strict /elect still selects no failed
      // candidate and therefore never transfers generated output without :fallback.
      flushNestedReliabilityDiagnostics(electNode, diagnosticFork.forkStore, store)
      flushValidateTitles(allValidates, diagnosticFork.forkStore, store)
      // Never let an assertion cell keep a verdict from an earlier run. The flush
      // copies a cell only when the diagnostic fork carries it, so a cell that fork
      // never judged keeps whatever title it already had, which on a re-run is the
      // previous run's verdict: an elect reading [✗ 0/n] beside an assertion cell
      // still wearing an earlier [✓]. Strip the inherited verdict; do not author a
      // new one and do not emit the cell, which stays outside the output snapshot
      // until a run actually judges it.
      for (const validateNode of allValidates) {
        const targetValidate = store.getNode(validateNode.id)
        if (!targetValidate) continue
        const sourceValidate = diagnosticFork.forkStore.getNode(validateNode.id)
        if (sourceValidate && sourceValidate.title) continue
        targetValidate.title = stripReliabilitySuffix(targetValidate.title)
      }
    }
    const currentElect = store.getNode(electNode.id) ?? electNode
    currentElect.title = appendElectSuffix(baseTitle, {
      eligible: eligibleCount,
      total: n,
      fallback,
      winnerForkIndex: null,
      noSignal: verdict?.noSignal ?? false,
    })
    if (verdict) {
      currentElect.reliabilityMetadata = buildReliabilityMetadata(verdict, forkResults, eligibleCount, n)
    }
    store.importer.createErrorNode(
      verdict?.allGateFiltered
        ? gateFilteredErrorMessage(n, forkResults)
        : `/elect :n=${n} — all ${n} fork(s) failed; use :fallback to accept best degraded result`,
      currentElect.id,
    )
    store.saveNodeToOutput(currentElect.id)
    emitter.electComplete(electNode.id, null, n)
    memoMap.set(electNode.id, null)
    return
  }

  const winnerFork = forkResults.find(f => f.forkIndex === verdict.winnerForkIndex)
  if (!winnerFork?.forkStore) {
    electNode.title = appendElectSuffix(baseTitle, {
      eligible: okCount,
      total: n,
      fallback,
      winnerForkIndex: null,
      noSignal: false,
    })
    store.importer.createErrorNode(`/elect :n=${n} — winner fork has no store (internal error)`, electNode.id)
    store.saveNodeToOutput(electNode.id)
    emitter.electComplete(electNode.id, null, n)
    memoMap.set(electNode.id, null)
    return
  }
  StoreFork.applyCandidate(store, winnerFork.forkStore, electNode.id)
  reattachWinnerToAncestor(store, electNode.id, originalParentId)
  copyParentPromptOutputToElect({
    sourceStore: winnerFork.forkStore,
    targetStore: store,
    parentNodeId: contentSourceId,
    electNodeId: electNode.id,
  })

  // Sibling validates are outside the elect subtree — applyCandidate does not transfer their titles.
  flushValidateTitles(allValidates, winnerFork.forkStore, store)

  const winnerNode = store.getNode(electNode.id)
  if (winnerNode) {
    winnerNode.title = appendElectSuffix(baseTitle, {
      eligible: okCount,
      total: n,
      fallback: verdict.selectionLayer === 'fallback',
      winnerForkIndex: verdict.winnerForkIndex,
      noSignal: !fallback && (verdict.noSignal ?? false),
      degradedInput: verdict.judgeInput?.degradedInput ?? false,
    })
    winnerNode.reliabilityMetadata = buildReliabilityMetadata(verdict, forkResults, okCount, n)
    store.saveNodeToOutput(electNode.id)
  }

  emitter.electComplete(electNode.id, verdict.winnerForkIndex, n, {
    fallbackUsed: verdict.selectionLayer === 'fallback',
    generatorOnlyJudge: verdict.generatorOnlyJudge ?? false,
    judgeReasoningRequested: verdict.judgeReasoningRequested ?? false,
  })
  memoMap.set(electNode.id, winnerFork.forkStore)
}
