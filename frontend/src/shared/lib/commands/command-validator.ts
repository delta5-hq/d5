import { commandRegex } from './command-regex'
import type { DynamicAlias } from '../command-querytype-mapper'

export function hasValidCommand(command: string | null | undefined, dynamicAliases?: DynamicAlias[]): boolean {
  if (!command) return false
  const trimmed = command.trim()
  if (!trimmed) return false
  return commandRegex.anyWithOrder(dynamicAliases).test(trimmed)
}

export function canExecuteNode(
  command: string | null | undefined,
  isExecuting: boolean,
  dynamicAliases?: DynamicAlias[],
): boolean {
  if (isExecuting) return false
  return hasValidCommand(command, dynamicAliases)
}
