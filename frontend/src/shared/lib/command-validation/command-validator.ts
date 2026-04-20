import { matchesAnyCommandWithOrder } from './command-matcher'

export interface CommandValidationResult {
  isValid: boolean
  canExecute: boolean
  reason?: string
}

export function validateCommandForExecution(
  command: string | undefined,
  isExecuting: boolean,
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

  const hasValidCommand = matchesAnyCommandWithOrder(command.trim())

  if (!hasValidCommand) {
    return {
      isValid: false,
      canExecute: false,
      reason: 'invalid_command_syntax',
    }
  }

  return {
    isValid: true,
    canExecute: true,
  }
}
