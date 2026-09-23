import { REFINE_QUERY } from '@shared/lib/commands/command-constants'

const REFINE_CELL_RE = new RegExp(`^${REFINE_QUERY.replace('/', '\\/')}(?:\\s|$)`)
const N_RE = /:n=(\d+)(?=\s|$)/

export const readRefineN = (command: string | undefined): number | null => {
  if (!command || !REFINE_CELL_RE.test(command)) return null
  const match = command.match(N_RE)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return n >= 1 ? n : null
}

export const readRefineTrailingText = (command: string | undefined): string => {
  if (!command || !REFINE_CELL_RE.test(command)) return ''
  return command.replace(REFINE_CELL_RE, '').replace(N_RE, '').trim()
}
