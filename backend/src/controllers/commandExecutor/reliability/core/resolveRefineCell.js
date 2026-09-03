import {readRawRefineN, readRefineN, readRefineTrailingText} from './refineParams'
import {parseInlineTerm} from './inlineTermParser'
import {CriteriaFailedError} from './CriteriaFailedError'
import {isSideEffectingDispatch} from './sideEffectingDispatch'
import {captureStoreExecutionSnapshot, restoreStoreExecutionSnapshot} from './StoreExecutionSnapshot'
import {appendRefineSuffix} from './reliabilitySuffix'
import {buildRefineReliabilityMetadata} from './reliabilityMetadataFields'
import {COMMODITY_SUPPRESSION_CAUSE} from './failureSemantics'
import {
  evaluateValidateGroup,
  applyValidateResults,
  firstFailedValidate,
  countPassingValidates,
  writeInvalidModifier,
} from './validateGroup'
import {getNodeCommand, isValidate} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {clearCommandsWithParams} from '../../constants'

/**
 * @typedef {import('../../commands/utils/Store').default} Store
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 */

export const REFINE_OUTCOME = Object.freeze({
  INVALID: 'invalid',
  RESOLVED: 'resolved',
})

function buildRefineAttemptContext(originalContext, criterion, reason) {
  const injected = reason
    ? `[Refinement attempt] Ensure your response satisfies: "${criterion}". Previous attempt failed because: ${reason}. `
    : `[Refinement attempt] Ensure your response satisfies: "${criterion}". `
  return injected + (originalContext || '')
}

function captureRefineAttempt(attempts, results, store, rootId) {
  return {
    attempts,
    results,
    passedCount: countPassingValidates(results),
    snapshot: captureStoreExecutionSnapshot(store, rootId),
  }
}

function isBetterRefineAttempt(candidate, best) {
  if (!best) return true
  return candidate.passedCount > best.passedCount
}

function readValidateChildren(refineCell, store) {
  return (refineCell.children ?? []).map(id => store.getNode(id)).filter(isValidate)
}

function invalidSyntaxMessage(query, trailingText) {
  const rawN = readRawRefineN(query)
  if (trailingText) return `Error: /refine accepts only :n=N; unexpected text: "${trailingText}"`
  if (rawN === 0) return 'Error: /refine :n=0 is a no-op — minimum is :n=1'
  return 'Error: /refine requires :n=N (e.g. /refine :n=3)'
}

/**
 * Resolves a `/refine :n=N` cell: bounded regeneration of a generating term that
 * keeps the best attempt against its `/validate` children.
 *
 * The term is inline (`/refine :n=N /chat ...`) or, for a legacy child refine,
 * inherited from the parent scope (`parentQueryType`/`parentPrompt`). Generation
 * and post-processing are injected so this module stays free of the executor's
 * command-dispatch and post-processing closures.
 *
 * @param {NodeData} refineCell the `/refine` cell carrying `:n=N` and validates
 * @param {Store} store
 * @param {{
 *   context: string,
 *   parentCell?: NodeData|null,
 *   parentQueryType?: string,
 *   parentPrompt?: string,
 *   parentSideEffecting?: boolean,
 *   signal: AbortSignal|null,
 *   executeTerm: (queryType: string, context: string, prompt: string, cell: NodeData) => Promise<void>,
 *   postProcessTerm: (rootId: string, excludedIds: string[]) => Promise<void>,
 * }} deps
 * @returns {Promise<REFINE_OUTCOME[keyof REFINE_OUTCOME]>} INVALID when an error
 *   node was written; RESOLVED when refinement completed and every criterion passed.
 *   Throws {@link CriteriaFailedError} when the best attempt still fails a criterion.
 */
export async function resolveRefineCell(
  refineCell,
  store,
  {
    context,
    parentCell = null,
    parentQueryType,
    parentPrompt,
    parentSideEffecting = false,
    signal,
    executeTerm,
    postProcessTerm,
  },
) {
  const query = getNodeCommand(refineCell)
  const maxAttempts = readRefineN(query)
  const trailingText = readRefineTrailingText(query)
  const inlineTerm = parseInlineTerm(trailingText, store._aliases)
  const validates = readValidateChildren(refineCell, store)

  if (!maxAttempts || (trailingText && !inlineTerm)) {
    writeInvalidModifier(refineCell, store, invalidSyntaxMessage(query, trailingText))
    return REFINE_OUTCOME.INVALID
  }

  if (validates.length === 0) {
    writeInvalidModifier(refineCell, store, 'Error: /refine requires at least one direct /validate child')
    return REFINE_OUTCOME.INVALID
  }

  const generationCell = inlineTerm ? refineCell : parentCell
  const generationRootId = generationCell.id
  const {
    queryType: termQueryType,
    mcpAlias,
    rpcAlias,
  } = inlineTerm
    ? resolveCommand(inlineTerm, store._aliases)
    : {queryType: parentQueryType, mcpAlias: null, rpcAlias: null}
  const termPrompt = inlineTerm ? clearCommandsWithParams(inlineTerm) : parentPrompt
  const termSideEffecting = inlineTerm
    ? isSideEffectingDispatch({queryType: termQueryType, mcpAlias, rpcAlias})
    : parentSideEffecting
  const validateScope = [refineCell.id, ...validates.map(v => v.id)]

  if (inlineTerm) {
    await executeTerm(termQueryType, context, termPrompt, generationCell)
    await postProcessTerm(generationRootId, validateScope)
  }

  let attempts = 1
  let results = await evaluateValidateGroup(validates, store, signal)
  let bestAttempt = captureRefineAttempt(attempts, results, store, generationRootId)
  const attemptSnapshots = [bestAttempt.snapshot]
  let firstFail = firstFailedValidate(results)
  const retryWithheld = Boolean(firstFail && termSideEffecting && maxAttempts > 1)

  while (firstFail && attempts < maxAttempts && !termSideEffecting) {
    const retryContext = buildRefineAttemptContext(context, firstFail.criterion, firstFail.reason)
    await executeTerm(termQueryType, retryContext, termPrompt, generationCell)
    await postProcessTerm(generationRootId, validateScope)
    attempts++
    results = await evaluateValidateGroup(validates, store, signal)
    const currentAttempt = captureRefineAttempt(attempts, results, store, generationRootId)
    attemptSnapshots.push(currentAttempt.snapshot)
    if (isBetterRefineAttempt(currentAttempt, bestAttempt)) bestAttempt = currentAttempt
    firstFail = firstFailedValidate(results)
    if (!firstFail) bestAttempt = currentAttempt
  }

  restoreStoreExecutionSnapshot(store, bestAttempt.snapshot, {attemptSnapshots})
  results = bestAttempt.results
  const passed = !firstFailedValidate(results)
  applyValidateResults(validates, results, store)

  const currentRefine = store.getNode(refineCell.id) ?? refineCell
  currentRefine.title = appendRefineSuffix(currentRefine.title || '', {passed, attempts})
  currentRefine.reliabilityMetadata = buildRefineReliabilityMetadata({
    passed,
    attempts,
    requestedN: maxAttempts,
    ...(retryWithheld ? {suppressedCause: COMMODITY_SUPPRESSION_CAUSE.SIDE_EFFECTING_ALIAS} : {}),
  })
  store.saveNodeToOutput(currentRefine.id)

  if (!passed) {
    const failed = firstFailedValidate(results)
    throw new CriteriaFailedError(failed?.criterion ?? '', attempts)
  }

  return REFINE_OUTCOME.RESOLVED
}
