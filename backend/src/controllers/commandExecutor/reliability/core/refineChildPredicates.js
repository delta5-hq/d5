import {getNodeCommand} from '../../commands/utils/isCommand'
import {FOREACH_QUERY} from '../../constants/foreach'
import {MEMORIZE_QUERY} from '../../constants/memorize'
import {OUTLINE_QUERY, readSummarizeParam} from '../../constants/outline'
import {REFINE_QUERY} from '../../constants/refine'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'

export function isPostProcessorOrControlQuery(query) {
  return (
    !query ||
    query.startsWith(FOREACH_QUERY) ||
    query.startsWith(SUMMARIZE_QUERY) ||
    query.startsWith(MEMORIZE_QUERY) ||
    query.startsWith(REFINE_QUERY) ||
    query.startsWith(VALIDATE_QUERY) ||
    (query.startsWith(OUTLINE_QUERY) && readSummarizeParam(query))
  )
}

export function hasRefineDescendant(node, store) {
  for (const childId of node.children ?? []) {
    const child = store.getNode(childId)
    if (!child) continue
    if (getNodeCommand(child)?.startsWith(REFINE_QUERY)) return true
    if (hasRefineDescendant(child, store)) return true
  }
  return false
}
