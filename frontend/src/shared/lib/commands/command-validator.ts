import { commandRegex } from './command-regex'
import type { DynamicAlias } from '../command-querytype-mapper'

const SLASH_COMMAND_PATTERN = /^\s*(?:#-?\d+\s+)?\/\w/

export function isSlashCommand(command: string | null | undefined): boolean {
  if (!command) return false
  return SLASH_COMMAND_PATTERN.test(command)
}

export function hasValidCommand(command: string | null | undefined, dynamicAliases?: DynamicAlias[]): boolean {
  if (!command) return false
  const trimmed = command.trim()
  if (!trimmed) return false
  return commandRegex.anyWithOrder(dynamicAliases).test(trimmed)
}

export function canExecuteNode(command: string | null | undefined, isExecuting: boolean): boolean {
  if (isExecuting) return false
  return isSlashCommand(command)
}
