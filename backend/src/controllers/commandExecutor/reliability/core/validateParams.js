import {VALIDATE_QUERY} from '../../constants/validate'

const VALIDATE_CELL_RE = new RegExp(`^${VALIDATE_QUERY.replace('/', '\\/')}(?:\\s|$)`)
const N_RE = /:n=(\d+)/
const RETRY_RE = /:retry=(\d+)(?=\s|$)/
const VERIFIER_RE = /:verifier=\S+/
const STRIPPED_PARAMS_RES = [N_RE, RETRY_RE, VERIFIER_RE]

export const isValidateCell = command => typeof command === 'string' && VALIDATE_CELL_RE.test(command)

export const readValidateN = command => {
  if (!command) return 1
  const match = command.match(N_RE)
  if (!match) return 1
  const n = parseInt(match[1], 10)
  return n >= 1 ? n : 1
}

export const hasValidateRetry = command => typeof command === 'string' && RETRY_RE.test(command)

export const readValidateCriterion = command => {
  if (!command) return ''
  let text = command.replace(VALIDATE_CELL_RE, '')
  for (const re of STRIPPED_PARAMS_RES) {
    text = text.replace(re, '')
  }
  return text.trim()
}

export const hasValidCriterion = command => readValidateCriterion(command).length > 0
