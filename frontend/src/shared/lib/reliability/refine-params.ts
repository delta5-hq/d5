import { REFINE_QUERY } from '@shared/lib/commands/command-constants'

const N_PATTERN = /:n=(\d+)/
const REFINE_CELL_PATTERN = new RegExp(`^${REFINE_QUERY.replace('/', '\\/')}(?:\\s|$)`)

export const readRefineN = (command: string | undefined): number | null => {
  if (!command) return null
  const match = command.match(N_PATTERN)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return n >= 2 ? n : null
}

export const isValidRefineCell = (command: string | undefined): boolean => {
  if (!command) return false
  if (!REFINE_CELL_PATTERN.test(command)) return false
  return readRefineN(command) !== null
}
