import {FOREACH_QUERY} from '../../constants/foreach'
import {OUTLINE_PARAM_SUMMARIZE_REGEX, OUTLINE_QUERY} from '../../constants/outline'
import {clearStepsPrefix, STEPS_QUERY} from '../../constants/steps'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'
import {REFINE_QUERY} from '../../constants/refine'
import {ELECT_QUERY} from '../../constants/elect'
import {matchesCommand} from '../../constants/matchesCommand'

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

export const isValidate = node => {
  if (!node) return false

  const field = getNodeCommand(node)

  if (field) {
    return matchesCommand(field, VALIDATE_QUERY)
  }

  return false
}

export const isRefine = node => {
  if (!node) return false
  return matchesCommand(getNodeCommand(node), REFINE_QUERY)
}

export const isElect = node => {
  if (!node) return false
  return matchesCommand(getNodeCommand(node), ELECT_QUERY)
}

export const isOutlineSummarize = str => {
  return str.startsWith(OUTLINE_QUERY) && !!str.match(new RegExp(OUTLINE_PARAM_SUMMARIZE_REGEX))
}
