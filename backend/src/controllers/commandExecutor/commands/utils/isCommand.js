import {commandRegExp} from '../../constants/commandRegExp'
import {FOREACH_QUERY} from '../../constants/foreach'
import {OUTLINE_PARAM_SUMMARIZE_REGEX, OUTLINE_QUERY} from '../../constants/outline'
import {clearStepsPrefix, STEPS_QUERY} from '../../constants/steps'
import {SUMMARIZE_QUERY} from '../../constants/summarize'

export const isContainsCommand = node => {
  if (!node) return false

  if (node.command) {
    return commandRegExp.any.test(node.command)
  }

  if (node.title) {
    return commandRegExp.any.test(node.title)
  }

  return false
}

export const isCommandStr = str => {
  if (!str) return false

  return commandRegExp.any.test(str)
}

export const isSteps = node => {
  if (!node) return false

  const field = node.command || node.title

  if (field) {
    const clearedField = clearStepsPrefix(field)

    return clearedField.startsWith(STEPS_QUERY)
  }

  return false
}

export const isForeach = node => {
  if (!node) return false

  const field = node.command || node.title

  if (field) {
    return field.startsWith(FOREACH_QUERY)
  }

  return false
}

export const isSummarize = node => {
  if (!node) return false

  const field = node.command || node.title

  if (field) {
    return field.startsWith(SUMMARIZE_QUERY)
  }

  return false
}

export const isOutlineSummarize = str => {
  return str.startsWith(OUTLINE_QUERY) && !!str.match(new RegExp(OUTLINE_PARAM_SUMMARIZE_REGEX))
}
