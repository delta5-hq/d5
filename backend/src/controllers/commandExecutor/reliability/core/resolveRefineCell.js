import {readRawRefineN, readRefineN, readRefineTrailingText} from './refineParams'
import {parseInlineTerm} from './inlineTermParser'
import {CriteriaFailedError} from './CriteriaFailedError'
import {captureStoreExecutionSnapshot, restoreStoreExecutionSnapshot} from './StoreExecutionSnapshot'
import {appendRefineSuffix, appendInvalidSuffix} from './reliabilitySuffix'
import {buildRefineReliabilityMetadata} from './reliabilityMetadataFields'
import {
  externalDispatchRefusalMessage,
  buildExternalDispatchRefusalMetadata,
  commandIsExternalDispatch,
} from './externalDispatchRefusal'
import {isExternalDispatchShape} from './externalDispatch'
import {firstInadmissibleInlineTermChild, inlineTermChildRefusalMessage} from './inlineTermChildAdmission'
import {
  evaluateValidateGroup,
  applyValidateResults,
  firstFailedValidate,
  countPassingValidates,
  writeInvalidModifier,
} from './validateGroup'
import {getNodeCommand, isValidate} from '../../commands/utils/isCommand'
import {clearStepsPrefix, STEPS_QUERY_TYPE} from '../../constants/steps'
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
 *   parentIsExternalDispatch?: boolean,
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
    parentIsExternalDispatch = false,
    signal,
    executeTerm,
    postProcessTerm,
  },
) {
  const query = clearStepsPrefix(getNodeCommand(refineCell))
  const maxAttempts = readRefineN(query)
  const trailingText = readRefineTrailingText(query)
  const inlineTerm = parseInlineTerm(trailingText, store._aliases)
  const trailingIsExternalDispatch = isExternalDispatchShape(trailingText)
  const validates = readValidateChildren(refineCell, store)

  // An `/mcp:`/`/rpc:`-shaped term is an external dispatch, refused below by its shape alone even
  // when the alias is unconfigured; it is never the invalid trailing text this guard rejects.
  if (!maxAttempts || (trailingText && !inlineTerm && !trailingIsExternalDispatch)) {
    writeInvalidModifier(refineCell, store, invalidSyntaxMessage(query, trailingText))
    return REFINE_OUTCOME.INVALID
  }

  const generationCell = inlineTerm ? refineCell : parentCell
  const generationRootId = generationCell?.id
  const {queryType: termQueryType} = inlineTerm
    ? resolveCommand(inlineTerm, store._aliases)
    : {queryType: parentQueryType}
  const termPrompt = inlineTerm ? clearCommandsWithParams(inlineTerm) : parentPrompt
  const termCommand = inlineTerm ?? trailingText
  const termIsExternal = termCommand ? commandIsExternalDispatch(termCommand, store) : parentIsExternalDispatch

  // Refusal precedes the validate-required check: fan-out over an external dispatch is barred by the
  // dispatch shape itself, whether or not the cell also carries a /validate child.
  if (maxAttempts > 1 && termIsExternal) {
    const current = store.getNode(refineCell.id) ?? refineCell
    current.title = appendInvalidSuffix(current.title || '')
    current.reliabilityMetadata = buildExternalDispatchRefusalMetadata(maxAttempts, 'refine')
    store.importer.createErrorNode(externalDispatchRefusalMessage('/refine', maxAttempts), current.id)
    store.saveNodeToOutput(current.id)
    return REFINE_OUTCOME.INVALID
  }

  if (inlineTerm && termQueryType !== STEPS_QUERY_TYPE) {
    const inadmissible = firstInadmissibleInlineTermChild(refineCell, store)
    if (inadmissible) {
      writeInvalidModifier(refineCell, store, inlineTermChildRefusalMessage('/refine', getNodeCommand(inadmissible)))
      return REFINE_OUTCOME.INVALID
    }
  }

  if (validates.length === 0) {
    writeInvalidModifier(refineCell, store, 'Error: /refine requires at least one direct /validate child')
    return REFINE_OUTCOME.INVALID
  }

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

  while (firstFail && attempts < maxAttempts) {
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

  restoreStoreExecutionSnapshot(store, bestAttempt.snapshot, {
    attemptSnapshots,
  })
  results = bestAttempt.results
  const passed = !firstFailedValidate(results)
  applyValidateResults(validates, results, store)

  const currentRefine = store.getNode(refineCell.id) ?? refineCell
  currentRefine.title = appendRefineSuffix(currentRefine.title || '', {
    passed,
    attempts,
  })
  currentRefine.reliabilityMetadata = buildRefineReliabilityMetadata({
    passed,
    attempts,
    requestedN: maxAttempts,
  })
  store.saveNodeToOutput(currentRefine.id)

  if (!passed) {
    const failed = firstFailedValidate(results)
    throw new CriteriaFailedError(failed?.criterion ?? '', attempts, failed?.reason)
  }

  return REFINE_OUTCOME.RESOLVED
}
