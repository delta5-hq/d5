import type { NodeData, NodeDatas } from '@shared/base-types'
import { readCommodityN } from './commodity-params'

export const hasMaterializedPromptOutput = (node: NodeData, nodes: NodeDatas): boolean =>
  (node.prompts ?? []).some(promptId => Boolean(nodes[promptId]))

const isSideEffectingQueryType = (queryType: string | undefined): boolean =>
  queryType === 'mcp-fusion' || queryType?.startsWith('mcp:') === true || queryType?.startsWith('rpc:') === true

// NOTE: Projectors must additionally guard on electChildScope === 0 before subtracting the saving — cost-model-only, does not affect runner admission.
export const admitsSourceCandidate = ({
  admitSourceCandidate,
  n,
  parentQueryType,
  parent,
  nodes,
}: {
  admitSourceCandidate: boolean
  n: number
  parentQueryType?: string
  electNode: NodeData
  parent: NodeData
  nodes: NodeDatas
}): boolean => {
  if (!admitSourceCandidate) return false
  const effectiveN = isSideEffectingQueryType(parentQueryType) ? 1 : n
  return effectiveN > 1 && hasMaterializedPromptOutput(parent, nodes) && readCommodityN(parent.command) === 1
}
