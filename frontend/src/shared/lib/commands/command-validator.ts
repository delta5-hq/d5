import { commandRegex } from './command-regex'

export function hasValidCommand(command: string | null | undefined): boolean {
  if (!command) return false
  const trimmed = command.trim()
  if (!trimmed) return false
  return commandRegex.anyWithOrder.test(trimmed)
}

export function canExecuteNode(command: string | null | undefined, isExecuting: boolean): boolean {
  if (isExecuting) return false
  return hasValidCommand(command)
}
