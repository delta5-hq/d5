import { matchesAnyCommandWithOrder, extractCommand } from '../command-validation/command-matcher'
import { getFullCommandMap, type DynamicAlias } from '../command-querytype-mapper'
import type { NodeId, NodeData } from '@shared/base-types'

// Mirror of backend reliability/core/nonGeneratingTermTypes.js. Control-flow and post-processor
// query types consume existing output rather than generating a fresh candidate, so they cannot serve
// as an /elect or /refine term. Pinned to the backend set by the mechanical parity tests on both stacks.
export const NON_GENERATING_TERM_QUERY_TYPES = new Set<string>([
  'elect',
  'foreach',
  'memorize',
  'outline',
  'refine',
  'steps',
  'summarize',
  'switch',
  'validate',
])

const stripOrderPrefix = (trailingText: string): string => trailingText.replace(/^#-?\d+\s+/, '')

const isNonGeneratingTerm = (trailingText: string, aliases?: DynamicAlias[]): boolean => {
  const commandToken = extractCommand(trailingText, aliases)
  if (!commandToken) return false
  const queryType = getFullCommandMap(aliases)[commandToken]
  return queryType !== undefined && NON_GENERATING_TERM_QUERY_TYPES.has(queryType)
}

export const parseInlineTerm = (trailingText: string | undefined, aliases?: DynamicAlias[]): string | null => {
  if (!trailingText) return null
  const normalized = stripOrderPrefix(trailingText)
  if (isNonGeneratingTerm(normalized, aliases)) return null
  return matchesAnyCommandWithOrder(normalized, aliases) ? trailingText : null
}

export const syntheticTermParentId = (nodeId: NodeId): NodeId => nodeId + ':term'

export const buildSyntheticTermParent = (nodeId: NodeId, command: string, parentId?: NodeId | null): NodeData => ({
  id: syntheticTermParentId(nodeId),
  command,
  title: command,
  parent: parentId ?? undefined,
  children: [nodeId],
  prompts: [],
})
