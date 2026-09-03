import { matchesAnyCommandWithOrder } from './command-matcher'
import { readElectTrailingText } from '@shared/lib/reliability/elect-params'
import { readRefineN, readRefineTrailingText } from '@shared/lib/reliability/refine-params'
import { parseInlineTerm } from '@shared/lib/reliability/inline-term-parser'
import type { DynamicAlias } from '@shared/lib/command-querytype-mapper'

export type ReliabilitySyntaxErrorReason =
  | 'elect_criterion_must_be_validate'
  | 'validate_retry_must_be_refine'
  | 'invalid_refine_syntax'

const RELIABILITY_SYNTAX_ERROR_REASONS = new Set<ReliabilitySyntaxErrorReason>([
  'elect_criterion_must_be_validate',
  'validate_retry_must_be_refine',
  'invalid_refine_syntax',
])

const matchesCommand = (command: string, keyword: string): boolean =>
  command === keyword || (command.startsWith(keyword) && /\s/.test(command.charAt(keyword.length)))

export function isReliabilitySyntaxErrorReason(reason: string | undefined): reason is ReliabilitySyntaxErrorReason {
  return RELIABILITY_SYNTAX_ERROR_REASONS.has(reason as ReliabilitySyntaxErrorReason)
}

export interface CommandValidationResult {
  isValid: boolean
  canExecute: boolean
  reason?: string
}

export function validateCommandForExecution(
  command: string | undefined,
  isExecuting: boolean,
  dynamicAliases?: DynamicAlias[],
): CommandValidationResult {
  if (isExecuting) {
    return {
      isValid: true,
      canExecute: false,
      reason: 'execution_in_progress',
    }
  }

  if (!command || !command.trim()) {
    return {
      isValid: true,
      canExecute: false,
      reason: 'empty_command',
    }
  }

  const hasValidCommand = matchesAnyCommandWithOrder(command.trim(), dynamicAliases)

  if (!hasValidCommand) {
    return {
      isValid: false,
      canExecute: false,
      reason: 'invalid_command_syntax',
    }
  }

  const normalized = command.trim().replace(/^#-?\d+\s+/, '')
  const electTrailing = readElectTrailingText(normalized)
  if (matchesCommand(normalized, '/elect') && electTrailing && !parseInlineTerm(electTrailing, dynamicAliases)) {
    return { isValid: false, canExecute: false, reason: 'elect_criterion_must_be_validate' }
  }
  if (matchesCommand(normalized, '/validate') && /:retry=\d+(?=\s|$)/.test(normalized)) {
    return { isValid: false, canExecute: false, reason: 'validate_retry_must_be_refine' }
  }
  // /refine :n=N accepts an inline generating term, mirroring /elect; trailing text that is not a
  // recognized generating command (criterion prose, a non-generating command) is refused, matching
  // the backend. A bare /refine :n=N stays valid as a child that refines its parent's output.
  const refineTrailing = readRefineTrailingText(normalized)
  if (
    matchesCommand(normalized, '/refine') &&
    (readRefineN(normalized) === null ||
      (refineTrailing.length > 0 && !parseInlineTerm(refineTrailing, dynamicAliases)))
  ) {
    return { isValid: false, canExecute: false, reason: 'invalid_refine_syntax' }
  }

  return {
    isValid: true,
    canExecute: true,
  }
}
