import {getNodeCommand} from '../../commands/utils/isCommand'
import {readCommodityN} from './commodityParams'

export const hasMaterializedPromptOutput = (node, store) =>
  (node?.prompts ?? []).some(promptId => store.getNode(promptId))

// The parent's own output may seed fork 0 only when it was really produced in this store and the
// parent is not itself a commodity fan-out. External-dispatch fan-out is refused upstream, so no
// dispatch-kind guard is needed here.
export const admitsSourceCandidate = ({admitSourceCandidate, n, parentNode, store}) => {
  if (!admitSourceCandidate) return false
  return n > 1 && hasMaterializedPromptOutput(parentNode, store) && readCommodityN(getNodeCommand(parentNode)) === 1
}
