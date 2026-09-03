import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {clearStepsPrefix} from '../../constants/steps'
import {NON_GENERATING_TERM_QUERY_TYPES} from './nonGeneratingTermTypes'

const resolveTermQueryType = (trailingText, aliases) =>
  resolveCommand(clearStepsPrefix(trailingText), aliases).queryType

const isNonGeneratingTerm = (trailingText, aliases) => {
  const queryType = resolveTermQueryType(trailingText, aliases)
  return queryType !== undefined && NON_GENERATING_TERM_QUERY_TYPES.has(queryType)
}

export const parseInlineTerm = (trailingText, aliases) => {
  if (!trailingText) return null
  if (isNonGeneratingTerm(trailingText, aliases)) return null
  return resolveTermQueryType(trailingText, aliases) ? trailingText : null
}

export const syntheticTermParentId = nodeId => nodeId + ':term'

// Descriptor for the term the modifier wraps, represented as the elect's parent so the
// existing fork machinery executes it. A wrapped term has no generation standing outside
// its scope, so the descriptor holds no prior output and never contributes a source
// candidate: every fork is a fresh generation. The descriptor is only ever inserted into
// disposable fork stores (see forkTermMount); the outer store is never mutated.
export const buildSyntheticTermParent = (nodeId, command, parentId = null) => ({
  id: syntheticTermParentId(nodeId),
  command,
  title: command,
  parent: parentId,
  children: [nodeId],
  prompts: [],
})
