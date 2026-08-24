import { ELECT_QUERY } from '@shared/lib/commands/command-constants'

const N_PATTERN = /:n=(\d+)(?=\s|$)/
const FALLBACK_PATTERN = /:fallback(?=\s|$)/
const JUDGE_REASONING_PATTERN = /:judge_reasoning(?=\s|$)/
const KNOWN_PARAM_PATTERNS = [N_PATTERN, FALLBACK_PATTERN, JUDGE_REASONING_PATTERN, /:limit=\S+(?=\s|$)/]
const ELECT_CELL_PATTERN = new RegExp(`^${ELECT_QUERY.replace('/', '\\/')}(?:\\s|$)`)

export const readElectN = (command: string | undefined): number | null => {
  if (!command || !ELECT_CELL_PATTERN.test(command)) return null
  const match = command.match(N_PATTERN)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return n >= 2 ? n : null
}

export const isValidElectCell = (command: string | undefined): boolean => {
  if (!command) return false
  if (!ELECT_CELL_PATTERN.test(command)) return false
  return readElectN(command) !== null
}

export const readElectTrailingText = (command: string | undefined): string => {
  if (!command || !ELECT_CELL_PATTERN.test(command)) return ''
  let text = command.replace(ELECT_CELL_PATTERN, '')
  for (const pattern of KNOWN_PARAM_PATTERNS) text = text.replace(pattern, '')
  return text.trim()
}
