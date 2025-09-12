import {FOREACH_QUERY} from '../../constants/foreach'
import {OUTLINE_PARAM_SUMMARIZE_REGEX, OUTLINE_QUERY} from '../../constants/outline'
import {SUMMARIZE_QUERY} from '../../constants/summarize'

export const checkIsPostProccess = str => {
  return (
    str.startsWith(FOREACH_QUERY) ||
    str.startsWith(SUMMARIZE_QUERY) ||
    (str.startsWith(OUTLINE_QUERY) && str.match(new RegExp(OUTLINE_PARAM_SUMMARIZE_REGEX)))
  )
}
