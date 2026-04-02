import { COMMAND_TO_QUERYTYPE_MAP } from './command-querytype-mapper'

const STEP_PREFIX_PATTERN = '#(-?\\d+)'

function getAllCommandKeys(): string[] {
  return Object.keys(COMMAND_TO_QUERYTYPE_MAP)
}

function escapeRegexCommand(command: string): string {
  return command.replace(/\//g, '\\/')
}

function createCommandPattern(commands: string[], withOrderPrefix: boolean): RegExp {
  const escapedCommands = commands.map(escapeRegexCommand)
  const commandsPattern = escapedCommands.join('|')
  const orderPart = withOrderPrefix ? `(?:${STEP_PREFIX_PATTERN}\\s+)?` : ''
  return new RegExp(`^\\s*${orderPart}(${commandsPattern})(\\s+|$)`, '')
}

export function matchesAnyCommand(text: string | undefined): boolean {
  if (!text) return false
  const pattern = createCommandPattern(getAllCommandKeys(), false)
  return pattern.test(text)
}

export function matchesAnyCommandWithOrder(text: string | undefined): boolean {
  if (!text) return false
  const pattern = createCommandPattern(getAllCommandKeys(), true)
  return pattern.test(text)
}

export function clearStepsPrefix(text: string): string {
  return text.replace(new RegExp(STEP_PREFIX_PATTERN, 'g'), '').trim()
}

export function hasStepsPrefix(text: string): boolean {
  return new RegExp(STEP_PREFIX_PATTERN).test(text)
}

export function extractStepNumber(text: string): number | null {
  const match = text.match(new RegExp(`^\\s*${STEP_PREFIX_PATTERN}`))
  return match ? parseInt(match[1], 10) : null
}

export { COMMAND_TO_QUERYTYPE_MAP }
