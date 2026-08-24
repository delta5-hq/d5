import {FOREACH_QUERY} from '../../constants/foreach'
import {OUTLINE_PARAM_SUMMARIZE_REGEX, OUTLINE_QUERY} from '../../constants/outline'
import {ELECT_QUERY} from '../../constants/elect'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'
import {REFINE_QUERY} from '../../constants/refine'
import {matchesCommand} from '../../constants/matchesCommand'

/**
 * @param {string} str
 * @returns {boolean}
 */
export const checkIsPostProccess = str => {
  return (
    matchesCommand(str, FOREACH_QUERY) ||
    matchesCommand(str, SUMMARIZE_QUERY) ||
    matchesCommand(str, ELECT_QUERY) ||
    matchesCommand(str, VALIDATE_QUERY) ||
    matchesCommand(str, REFINE_QUERY) ||
    (str.startsWith(OUTLINE_QUERY) && str.match(new RegExp(OUTLINE_PARAM_SUMMARIZE_REGEX)))
  )
}
