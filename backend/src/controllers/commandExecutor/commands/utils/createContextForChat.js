import {clearCommandsWithParams, clearReferences, HASHREF_DEF_PREFIX, REF_DEF_PREFIX} from '../../constants'
import {commandRegExp} from '../../constants/commandRegExp'
import {clearStepsPrefix} from '../../constants/steps'

/**
 *
 * @param {Object} node
 * @param {string} [context="Context:\n```\n```\n"]
 * @param {Object} [params={}]
 * @param {number} [params.maxLength=2000] - Maximum length allowed for the resulting context
 * @param {Object} [params.allNodes={}]
 * @param {number} [params.parents=3] - Maximum number of parent levels to traverse
 * @param {number} [params.indent=0] - Number of spaces to indent the context for each level
 * @returns {string}
 */
export const createContextForChat = (node, params = {}, context = 'Context:\n```\n```\n') => {
  const {maxLength = 2000, allNodes = {}} = params
  let {parents = 3, indent = 0} = params

  const newString =
    node.title && !commandRegExp.any.test(node.title)
      ? clearCommandsWithParams(
          clearReferences(clearReferences(clearStepsPrefix(node.title), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
        ).trim()
      : ''
  let newContext = newString ? context.replace('```', `\`\`\`\n${newString}`) : context

  if (newString) {
    const startIndex = newContext.indexOf('\n', newContext.indexOf('\n') + 1) + 1
    const lastIndex = newContext.lastIndexOf('\n', newContext.lastIndexOf('\n') - 1) - 1

    // Replace '\n' with '\n  ' from the second occurrence to the penultimate occurrence for moving titles

    newContext =
      newContext.substring(0, startIndex) +
      newContext.substring(startIndex, lastIndex).replace(/\n/g, `\n${' '.repeat(indent)}`) +
      newContext.substring(lastIndex)
  }

  if (newContext.length > maxLength) {
    return context
  }

  context = newContext
  parents -= 1

  const parentNode = allNodes[node.parent]
  if (parentNode && parentNode.parent && parents) {
    context = createContextForChat(parentNode, {...params, parents, indent: 2}, context)
  }

  return context
}
