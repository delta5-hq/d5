import {getNodeCommand} from '../../commands/utils/isCommand'
import {FOREACH_QUERY} from '../../constants/foreach'
import {MEMORIZE_QUERY} from '../../constants/memorize'
import {OUTLINE_QUERY, readSummarizeParam} from '../../constants/outline'
import {ELECT_QUERY} from '../../constants/elect'
import {SUMMARIZE_QUERY} from '../../constants/summarize'
import {VALIDATE_QUERY} from '../../constants/validate'
import {REFINE_QUERY} from '../../constants/refine'
import {matchesCommand} from '../../constants/matchesCommand'

export function isPostProcessorOrControlQuery(query) {
  return (
    !query ||
    matchesCommand(query, FOREACH_QUERY) ||
    matchesCommand(query, SUMMARIZE_QUERY) ||
    matchesCommand(query, MEMORIZE_QUERY) ||
    matchesCommand(query, ELECT_QUERY) ||
    matchesCommand(query, VALIDATE_QUERY) ||
    matchesCommand(query, REFINE_QUERY) ||
    (query.startsWith(OUTLINE_QUERY) && readSummarizeParam(query))
  )
}

export function hasElectDescendant(node, store) {
  for (const childId of node.children ?? []) {
    const child = store.getNode(childId)
    if (!child) continue
    if (matchesCommand(getNodeCommand(child), ELECT_QUERY)) return true
    if (hasElectDescendant(child, store)) return true
  }
  return false
}
