const TSHIRT_KEYS_LONGEST_FIRST = ['xxl', 'xxs', 'xl', 'xs', 'l', 's']

const TSHIRT_TO_EXECUTIONS = Object.freeze({
  xxs: 10,
  xs: 20,
  s: 50,
  l: 100,
  xl: 200,
  xxl: 500,
})

const TSHIRT_ALT = TSHIRT_KEYS_LONGEST_FIRST.join('|')
const LIMIT_TSHIRT_RE = new RegExp(`:limit=(${TSHIRT_ALT})(?=\\s|$)`)
const LIMIT_INT_RE = /:limit=(\d+)(?=\s|$)/

export const FORK_LIMIT_SIZES = TSHIRT_TO_EXECUTIONS

export const DEFAULT_FORK_LIMIT = TSHIRT_TO_EXECUTIONS.s

export const readForkLimit = command => {
  if (!command) return null

  const tshirt = command.match(LIMIT_TSHIRT_RE)
  if (tshirt) return TSHIRT_TO_EXECUTIONS[tshirt[1]]

  const raw = command.match(LIMIT_INT_RE)
  if (raw) return parseInt(raw[1], 10)

  return null
}

export const exceedsForkLimit = (projectedCost, limit) => {
  if (limit === null || limit === undefined) return false
  return projectedCost > limit
}

export const forkLimitRefusalMessage = (projectedCost, limit) =>
  `projected ${projectedCost} executions exceeds limit ${limit}`
