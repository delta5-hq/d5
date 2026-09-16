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

// A step order marker is only a single leading `#N ` token; a `#N` later in the text is prompt
// content (an issue number, a ranked count) and must survive. Anchored and non-global, mirroring
// the backend's STEPS_ORDER_PREFIX_REGEX (`/^#-?\d+\s+/`) so both stacks strip identically.
export const STEP_ORDER_PREFIX_PATTERN = '^#-?\\d+\\s+'

export function clearStepsPrefix(text: string): string {
  return text.trim().replace(new RegExp(STEP_ORDER_PREFIX_PATTERN), '')
}

export function hasStepsPrefix(text: string): boolean {
  return new RegExp(STEP_PREFIX_PATTERN).test(text)
}

export function extractStepNumber(text: string): number | null {
  const match = text.match(new RegExp(`^\\s*${STEP_PREFIX_PATTERN}`))
  return match ? parseInt(match[1], 10) : null
}

export { COMMAND_TO_QUERYTYPE_MAP }
