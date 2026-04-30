import {FOREACH_QUERY} from '../../constants/foreach'
import {OUTLINE_PARAM_SUMMARIZE_REGEX, OUTLINE_QUERY} from '../../constants/outline'
import {REFINE_QUERY} from '../../constants/refine'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'

/**
 * @param {string} str
 * @returns {boolean}
 */
export const checkIsPostProccess = str => {
  return (
    str.startsWith(FOREACH_QUERY) ||
    str.startsWith(SUMMARIZE_QUERY) ||
    str.startsWith(REFINE_QUERY) ||
    str.startsWith(VALIDATE_QUERY) ||
    (str.startsWith(OUTLINE_QUERY) && str.match(new RegExp(OUTLINE_PARAM_SUMMARIZE_REGEX)))
  )
}
