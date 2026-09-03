import {getNodeCommand} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {isSideEffectingDispatch} from './sideEffectingDispatch'
import {readCommodityN} from './commodityParams'

export const hasMaterializedPromptOutput = (node, store) =>
  (node?.prompts ?? []).some(promptId => store.getNode(promptId))

// Side-effect classification of an already-resolved parent node. The inline form passes the
// synthetic term parent here so suppression follows the wrapped term, not the enclosing scope.
export const isSideEffectingDispatchNode = (parentNode, store) => {
  if (!parentNode) return false
  const {queryType, mcpAlias, rpcAlias} = resolveCommand(getNodeCommand(parentNode), store._aliases)
  return isSideEffectingDispatch({queryType, mcpAlias, rpcAlias})
}

export const isSideEffectingParent = (electNode, store) =>
  isSideEffectingDispatchNode(store.getNode(electNode.parent), store)

// NOTE: Projectors must additionally guard on electChildScope === 0 before subtracting the saving — cost-model-only, does not affect runner admission.
export const admitsSourceCandidate = ({admitSourceCandidate, n, parentNode, store}) => {
  if (!admitSourceCandidate) return false
  const effectiveN = isSideEffectingDispatchNode(parentNode, store) ? 1 : n
  return (
    effectiveN > 1 && hasMaterializedPromptOutput(parentNode, store) && readCommodityN(getNodeCommand(parentNode)) === 1
  )
}
