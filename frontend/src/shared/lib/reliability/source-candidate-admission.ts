import type { NodeData, NodeDatas } from '@shared/base-types'
import { readCommodityN } from './commodity-params'

export const hasMaterializedPromptOutput = (node: NodeData, nodes: NodeDatas): boolean =>
  (node.prompts ?? []).some(promptId => Boolean(nodes[promptId]))

// NOTE: Projectors must additionally guard on electChildScope === 0 before subtracting the saving — cost-model-only, does not affect runner admission.
export const admitsSourceCandidate = ({
  admitSourceCandidate,
  n,
  parent,
  nodes,
}: {
  admitSourceCandidate: boolean
  n: number
  electNode: NodeData
  parent: NodeData
  nodes: NodeDatas
}): boolean => {
  if (!admitSourceCandidate) return false
  return n > 1 && hasMaterializedPromptOutput(parent, nodes) && readCommodityN(parent.command) === 1
}
