import {getNodeCommand} from '../../commands/utils/isCommand'
import {FOREACH_QUERY} from '../../constants/foreach'
import {MEMORIZE_QUERY} from '../../constants/memorize'
import {OUTLINE_QUERY, readSummarizeParam} from '../../constants/outline'
import {ELECT_QUERY} from '../../constants/elect'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'

export function isPostProcessorOrControlQuery(query) {
  return (
    !query ||
    query.startsWith(FOREACH_QUERY) ||
    query.startsWith(SUMMARIZE_QUERY) ||
    query.startsWith(MEMORIZE_QUERY) ||
    query.startsWith(ELECT_QUERY) ||
    query.startsWith(VALIDATE_QUERY) ||
    (query.startsWith(OUTLINE_QUERY) && readSummarizeParam(query))
  )
}

export function hasElectDescendant(node, store) {
  for (const childId of node.children ?? []) {
    const child = store.getNode(childId)
    if (!child) continue
    if (getNodeCommand(child)?.startsWith(ELECT_QUERY)) return true
    if (hasElectDescendant(child, store)) return true
  }
  return false
}
