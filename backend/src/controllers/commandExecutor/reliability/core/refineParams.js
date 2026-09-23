import {REFINE_QUERY} from '../../constants/refine'

const REFINE_CELL_RE = new RegExp(`^${REFINE_QUERY.replace('/', '\\/')}(?:\\s|$)`)
const N_RE = /:n=(\d+)(?=\s|$)/

export const isRefineCell = command => typeof command === 'string' && REFINE_CELL_RE.test(command)

export const readRawRefineN = command => {
  if (!command || !REFINE_CELL_RE.test(command)) return null
  const match = command.match(N_RE)
  return match ? parseInt(match[1], 10) : null
}

export const readRefineN = command => {
  const n = readRawRefineN(command)
  return n !== null && n >= 1 ? n : null
}

export const isValidRefineCell = command => isRefineCell(command) && readRefineN(command) !== null

export const readRefineTrailingText = command => {
  if (!isRefineCell(command)) return ''
  return command.replace(REFINE_CELL_RE, '').replace(N_RE, '').trim()
}
