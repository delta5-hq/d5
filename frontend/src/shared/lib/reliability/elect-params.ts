import { ELECT_QUERY } from '@shared/lib/commands/command-constants'

const N_PATTERN = /:n=(\d+)/
const ELECT_CELL_PATTERN = new RegExp(`^${ELECT_QUERY.replace('/', '\\/')}(?:\\s|$)`)

export const readElectN = (command: string | undefined): number | null => {
  if (!command) return null
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
