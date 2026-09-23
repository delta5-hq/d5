const TSHIRT_KEYS_LONGEST_FIRST = ['xxl', 'xxs', 'xl', 'xs', 'l', 's'] as const

type TshirtKey = (typeof TSHIRT_KEYS_LONGEST_FIRST)[number]

const TSHIRT_TO_EXECUTIONS: Readonly<Record<TshirtKey, number>> = {
  xxs: 10,
  xs: 20,
  s: 50,
  l: 100,
  xl: 200,
  xxl: 500,
}

const TSHIRT_ALT = TSHIRT_KEYS_LONGEST_FIRST.join('|')
const LIMIT_TSHIRT_RE = new RegExp(`:limit=(${TSHIRT_ALT})(?=\\s|$)`)
const LIMIT_INT_RE = /:limit=(\d+)(?=\s|$)/

export const FORK_LIMIT_SIZES: Readonly<Record<TshirtKey, number>> = TSHIRT_TO_EXECUTIONS

export const DEFAULT_FORK_LIMIT = TSHIRT_TO_EXECUTIONS.s

export const readForkLimit = (command: string | undefined | null): number | null => {
  if (!command) return null

  const tshirt = command.match(LIMIT_TSHIRT_RE)
  if (tshirt) return TSHIRT_TO_EXECUTIONS[tshirt[1] as TshirtKey]

  const raw = command.match(LIMIT_INT_RE)
  if (raw) return parseInt(raw[1], 10)

  return null
}

export const exceedsForkLimit = (projectedCost: number, limit: number | null | undefined): boolean => {
  if (limit === null || limit === undefined) return false
  return projectedCost > limit
}
