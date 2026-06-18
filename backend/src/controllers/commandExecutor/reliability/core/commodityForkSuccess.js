import {isExecutionErrorNode} from '../../commands/utils/executionNodeStatus'
import {passesCommodityGate} from './structuralGate'

// Thrown transport errors (HTTP 4xx/5xx, network) are machine-tagged by createErrorNode
// regardless of title content — title inspection alone cannot detect them. Neither gate
// subsumes the other: structural checks (empty, refusal) apply only to untagged nodes.
export const isCommodityForkSuccess = (node, forkIndex = null) =>
  !isExecutionErrorNode(node) && passesCommodityGate(node?.title, forkIndex)
