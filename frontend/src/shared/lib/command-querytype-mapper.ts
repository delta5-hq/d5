import { BUILTIN_COMMANDS } from './builtin-command-aliases'

export const COMMAND_TO_QUERYTYPE_MAP: Record<string, string> = Object.fromEntries(
  BUILTIN_COMMANDS.map(command => [command.alias, command.queryType]),
)

export type CommandQuery = keyof typeof COMMAND_TO_QUERYTYPE_MAP

export const COMMAND_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  BUILTIN_COMMANDS.map(command => [command.alias, command.description]),
)

export interface DynamicAlias {
  alias: string
  queryType?: string
  description?: string
}

export function getFullCommandMap(dynamicAliases?: DynamicAlias[]): Record<string, string> {
  const fullMap: Record<string, string> = { ...COMMAND_TO_QUERYTYPE_MAP }

  if (dynamicAliases) {
    dynamicAliases.forEach(({ alias, queryType }) => {
      if (alias && !fullMap[alias]) {
        fullMap[alias] = queryType || alias.substring(1)
      }
    })
  }

  return fullMap
}

export function getSupportedCommands(dynamicAliases?: DynamicAlias[]): readonly string[] {
  return Object.keys(getFullCommandMap(dynamicAliases))
}

export const extractQueryTypeFromCommand = (command: string | undefined, dynamicAliases?: DynamicAlias[]): string => {
  if (!command) return 'chat'

  const trimmed = command.trim()
  const firstWord = trimmed.split(/\s+/)[0]

  if (!firstWord.startsWith('/')) return 'chat'

  const fullMap = getFullCommandMap(dynamicAliases)
  const mappedQueryType = fullMap[firstWord]
  if (mappedQueryType) return mappedQueryType

  return 'unknown'
}
