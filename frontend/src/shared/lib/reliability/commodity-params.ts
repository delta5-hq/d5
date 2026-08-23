import {
  ELECT_QUERY,
  VALIDATE_QUERY,
  FOREACH_QUERY,
  STEPS_QUERY,
  SWITCH_QUERY,
  CASE_QUERY,
  SUMMARIZE_QUERY,
  MEMORIZE_QUERY,
  OUTLINE_QUERY,
} from '@shared/lib/commands/command-constants'

const COMMODITY_N_RE = /:n=(\d+)/

export const COMMODITY_N_MAX = 10

const NON_COMMODITY_PREFIXES = [
  ELECT_QUERY,
  VALIDATE_QUERY,
  FOREACH_QUERY,
  STEPS_QUERY,
  SWITCH_QUERY,
  CASE_QUERY,
  SUMMARIZE_QUERY,
  MEMORIZE_QUERY,
  OUTLINE_QUERY,
] as const

const isNonCommodityCell = (command: string): boolean =>
  NON_COMMODITY_PREFIXES.some(prefix => command.startsWith(prefix))

export const readCommodityN = (command: string | undefined): number => {
  if (!command || isNonCommodityCell(command)) return 1
  const match = command.match(COMMODITY_N_RE)
  if (!match) return 1
  const n = parseInt(match[1], 10)
  if (n < 2) return 1
  return Math.min(n, COMMODITY_N_MAX)
}

export const stripCommodityN = (text: string | null | undefined): string => {
  if (!text) return ''
  return text.replace(COMMODITY_N_RE, '').replace(/\s+/g, ' ').trim()
}
