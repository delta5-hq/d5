import {getNodeCommand} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {isSideEffectingDispatch} from './sideEffectingDispatch'
import {readCommodityN} from './commodityParams'

export const hasMaterializedPromptOutput = (node, store) =>
  (node.prompts ?? []).some(promptId => store.getNode(promptId))

export const isSideEffectingParent = (electNode, store) => {
  const parentNode = store.getNode(electNode.parent)
  if (!parentNode) return false
  const {queryType, mcpAlias, rpcAlias} = resolveCommand(getNodeCommand(parentNode), store._aliases)
  return isSideEffectingDispatch({queryType, mcpAlias, rpcAlias})
}

// NOTE: Projectors must additionally guard on electChildScope === 0 before subtracting the saving — cost-model-only, does not affect runner admission.
export const admitsSourceCandidate = ({admitSourceCandidate, n, electNode, parentNode, store}) => {
  if (!admitSourceCandidate) return false
  const effectiveN = isSideEffectingParent(electNode, store) ? 1 : n
  return (
    effectiveN > 1 && hasMaterializedPromptOutput(parentNode, store) && readCommodityN(getNodeCommand(parentNode)) === 1
  )
}
