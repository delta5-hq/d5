import {REFINE_QUERY} from '../../constants/refine'
import {VALIDATE_QUERY} from '../../constants/validate'
import {FOREACH_QUERY} from '../../constants/foreach'
import {STEPS_QUERY} from '../../constants/steps'
import {SWITCH_QUERY, CASE_QUERY} from '../../constants/switch'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {MEMORIZE_QUERY} from '../../constants/memorize'
import {OUTLINE_QUERY} from '../../constants/outline'

const COMMODITY_N_RE = /:n=(\d+)/

export const COMMODITY_N_MAX = 10

const NON_COMMODITY_PREFIXES = [
  REFINE_QUERY,
  VALIDATE_QUERY,
  FOREACH_QUERY,
  STEPS_QUERY,
  SWITCH_QUERY,
  CASE_QUERY,
  SUMMARIZE_QUERY,
  MEMORIZE_QUERY,
  OUTLINE_QUERY,
]

const isNonCommodityCell = command =>
  typeof command === 'string' && NON_COMMODITY_PREFIXES.some(p => command.startsWith(p))

export const readCommodityN = command => {
  if (!command || isNonCommodityCell(command)) return 1
  const m = command.match(COMMODITY_N_RE)
  if (!m) return 1
  const n = parseInt(m[1], 10)
  if (n < 2) return 1
  return Math.min(n, COMMODITY_N_MAX)
}

export const stripCommodityN = text => {
  if (!text) return ''
  return text.replace(COMMODITY_N_RE, '').replace(/\s+/g, ' ').trim()
}
