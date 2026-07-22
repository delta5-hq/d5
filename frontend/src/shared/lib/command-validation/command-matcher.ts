import { getSupportedCommands, type DynamicAlias } from '../command-querytype-mapper'

const STEP_PREFIX_PATTERN = '#(-?\\d+)'

function createCommandPattern(commands: readonly string[], withOrderPrefix: boolean): RegExp {
  const escapedCommands = commands.map(cmd => cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/'))
  const commandsPattern = escapedCommands.join('|')
  const orderPart = withOrderPrefix ? `(?:${STEP_PREFIX_PATTERN}\\s+)?` : ''
  return new RegExp(`^\\s*${orderPart}(${commandsPattern})(\\s+|$)`, '')
}

export function createCommandMatcher(dynamicAliases?: DynamicAlias[]) {
  const commands = getSupportedCommands(dynamicAliases)
  return {
    standard: createCommandPattern(commands, false),
    withOrder: createCommandPattern(commands, true),
  }
}

export function matchesAnyCommand(text: string | undefined, dynamicAliases?: DynamicAlias[]): boolean {
  if (!text) return false
  const matcher = createCommandMatcher(dynamicAliases)
  return matcher.standard.test(text)
}

export function matchesAnyCommandWithOrder(text: string | undefined, dynamicAliases?: DynamicAlias[]): boolean {
  if (!text) return false
  const matcher = createCommandMatcher(dynamicAliases)
  return matcher.withOrder.test(text)
}

export function extractCommand(text: string | undefined, dynamicAliases?: DynamicAlias[]): string | null {
  if (!text) return null
  const matcher = createCommandMatcher(dynamicAliases)
  const match = text.match(matcher.withOrder)
  return match ? match[match.length - 2] : null
}
