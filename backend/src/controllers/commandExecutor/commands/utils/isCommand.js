import {FOREACH_QUERY} from '../../constants/foreach'
import {OUTLINE_PARAM_SUMMARIZE_REGEX, OUTLINE_QUERY} from '../../constants/outline'
import {clearStepsPrefix, STEPS_QUERY} from '../../constants/steps'
import {SUMMARIZE_QUERY} from '../../constants/summarize'

/**
 * @param {Object} node
 * @returns {string} Command field with fallback to title (precedence: command > title > '')
 */
export const getNodeCommand = node => {
  return node?.command || node?.title || ''
}

export const isSteps = node => {
  if (!node) return false

  const field = getNodeCommand(node)

  if (field) {
    const clearedField = clearStepsPrefix(field)

    return clearedField.startsWith(STEPS_QUERY)
  }

  return false
}

export const isForeach = node => {
  if (!node) return false

  const field = getNodeCommand(node)

  if (field) {
    return field.startsWith(FOREACH_QUERY)
  }

  return false
}

export const isSummarize = node => {
  if (!node) return false

  const field = getNodeCommand(node)

  if (field) {
    return field.startsWith(SUMMARIZE_QUERY)
  }

  return false
}

export const isOutlineSummarize = str => {
  return str.startsWith(OUTLINE_QUERY) && !!str.match(new RegExp(OUTLINE_PARAM_SUMMARIZE_REGEX))
}
