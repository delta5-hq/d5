import {ValidateCommand} from './ValidateCommand'
import {hasValidCriterion, hasValidateRetry} from './validateParams'
import {CriteriaFailedError} from './CriteriaFailedError'
import {appendValidateSuffix, appendInvalidSuffix} from './reliabilitySuffix'
import {buildValidateReliabilityMetadata, buildInvalidReliabilityMetadata} from './reliabilityMetadataFields'
import {FAILURE_CAUSE, REMEDIATION_HINT} from './failureSemantics'
import {getNodeCommand} from '../../commands/utils/isCommand'

/**
 * @typedef {import('../../commands/utils/Store').default} Store
 * @typedef {import('../../commands/utils/Store').NodeData} NodeData
 * @typedef {{passed: boolean, criterion?: string, reason?: string}} ValidateResult
 */

export function countPassingValidates(results) {
  return results.filter(result => result?.passed).length
}

export function firstFailedValidate(results) {
  return results.find(result => !result?.passed)
}

export function applyValidateResults(validates, results, store) {
  validates.forEach((node, index) => {
    const current = store.getNode(node.id) ?? node
    const result = results[index]
    const passed = result?.passed ?? false
    current.title = appendValidateSuffix(current.title || '', {passed})
    current.reliabilityMetadata = buildValidateReliabilityMetadata({
      passed,
      criterion: result?.criterion,
      reason: result?.reason,
      failureCause: result?.failureCause,
    })
    store.saveNodeToOutput(current.id)
  })
}

export function writeInvalidModifier(node, store, message, failureCause = FAILURE_CAUSE.INVALID_CRITERIA) {
  const current = store.getNode(node.id) ?? node
  current.title = appendInvalidSuffix(current.title || '')
  current.reliabilityMetadata = buildInvalidReliabilityMetadata({
    failureCause,
    remediationHint: REMEDIATION_HINT.ADJUST_CRITERIA,
  })
  store.importer.createErrorNode(message, current.id)
  store.saveNodeToOutput(current.id)
}

/**
 * Evaluates a group of `/validate` cells against their shared scope's current
 * output, writing each cell's pass/fail suffix and reliability metadata.
 *
 * @param {NodeData[]} validates
 * @param {Store} store
 * @param {AbortSignal|null} signal
 * @returns {Promise<ValidateResult[]>}
 */
/**
 * Evaluates a validate group and throws {@link CriteriaFailedError} on the first failing criterion,
 * carrying its reason. The single gate used wherever candidates must be rejected by their assertions:
 * a scope's post-processing and a /steps fork alike. No-op for an empty group.
 *
 * @param {NodeData[]} validates
 * @param {Store} store
 * @param {AbortSignal|null} signal
 */
export async function gateOnValidateGroup(validates, store, signal) {
  if (validates.length === 0) return
  const results = await evaluateValidateGroup(validates, store, signal)
  const failed = firstFailedValidate(results)
  if (failed) throw new CriteriaFailedError(failed.criterion, 1, failed.reason)
}

export async function evaluateValidateGroup(validates, store, signal) {
  const invalid = validates.filter(
    node => !hasValidCriterion(getNodeCommand(node)) || hasValidateRetry(getNodeCommand(node)),
  )
  if (invalid.length > 0) {
    invalid.forEach(node => {
      const command = getNodeCommand(node)
      const message = hasValidateRetry(command)
        ? 'Error: /validate :retry is unsupported — wrap the generating command with /refine :n=N'
        : 'Error: /validate requires criterion text'
      writeInvalidModifier(node, store, message)
    })
    throw new CriteriaFailedError('', 1, FAILURE_CAUSE.INVALID_CRITERIA)
  }

  const validateCommand = new ValidateCommand(store._userId, store._workflowId, store)
  const results = await Promise.all(validates.map(node => validateCommand.run(node, {signal})))
  applyValidateResults(validates, results, store)
  return results
}
