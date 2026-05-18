import {CONTROL_FLOW_COMMANDS, DELEGATING_COMMANDS, DETERMINISTIC_COMMANDS} from '../../constants'
import {readRefineN} from './refineParams'

const isCommodityForkEligible = queryType =>
  typeof queryType === 'string' &&
  queryType.length > 0 &&
  !CONTROL_FLOW_COMMANDS.has(queryType) &&
  !DETERMINISTIC_COMMANDS.has(queryType) &&
  !DELEGATING_COMMANDS.has(queryType)

/**
 * @param {string|undefined} queryType
 * @param {string} command
 * @returns {number|null} null when queryType is ineligible, :n= is absent, or N < 2
 */
export const readCommodityN = (queryType, command) => {
  if (!isCommodityForkEligible(queryType)) return null
  return readRefineN(command)
}
