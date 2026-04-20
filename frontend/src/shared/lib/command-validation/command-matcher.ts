import { getAllCommands } from './command-registry'

const STEP_PREFIX_PATTERN = '#(-?\\d+)'

function createCommandPattern(commands: readonly string[], withOrderPrefix: boolean): RegExp {
  const escapedCommands = commands.map(cmd => cmd.replace(/\//g, '\\/'))
  const commandsPattern = escapedCommands.join('|')
  const orderPart = withOrderPrefix ? `(?:${STEP_PREFIX_PATTERN}\\s+)?` : ''
  return new RegExp(`^\\s*${orderPart}(${commandsPattern})(\\s+|$)`, '')
}

export function createCommandMatcher(commands: readonly string[] = getAllCommands()) {
  return {
    standard: createCommandPattern(commands, false),
    withOrder: createCommandPattern(commands, true),
  }
}

export function matchesAnyCommand(text: string | undefined): boolean {
  if (!text) return false
  const matcher = createCommandMatcher()
  return matcher.standard.test(text)
}

export function matchesAnyCommandWithOrder(text: string | undefined): boolean {
  if (!text) return false
  const matcher = createCommandMatcher()
  return matcher.withOrder.test(text)
}

export function extractCommand(text: string | undefined): string | null {
  if (!text) return null
  const matcher = createCommandMatcher()
  const match = text.match(matcher.withOrder)
  return match ? match[match.length - 2] : null
}
