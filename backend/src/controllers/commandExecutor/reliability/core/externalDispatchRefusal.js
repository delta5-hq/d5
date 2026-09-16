import {getNodeCommand} from '../../commands/utils/isCommand'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'
import {isExternalDispatch, isExternalDispatchShape} from './externalDispatch'
import {FAILURE_CAUSE, REMEDIATION_HINT} from './failureSemantics'

// A modifier or commodity count fans out one command into N runs. Over an external dispatch
// the engine cannot prove the call is safe to repeat, so N greater than one is refused
// outright: no run executes, nothing is elected, the cell carries the reason and the count.

export const commandIsExternalDispatch = (command, store) => {
  if (!command) return false
  if (isExternalDispatchShape(command)) return true
  const {queryType, mcpAlias, rpcAlias} = resolveCommand(command, store._aliases)
  return isExternalDispatch({queryType, mcpAlias, rpcAlias})
}

export const dispatchIsExternal = (node, store) =>
  node ? commandIsExternalDispatch(getNodeCommand(node), store) : false

export const externalDispatchRefusalMessage = (commandLabel, requestedN) =>
  `Error: ${commandLabel} cannot fan out :n=${requestedN} over an external dispatch (/mcp, /rpc); ` +
  'the engine cannot prove an external dispatch is safe to repeat.'

export const buildExternalDispatchRefusalMetadata = (requestedN, mode = 'invalid') => ({
  winnerForkIndex: null,
  perCriterionVerdict: [],
  mode,
  selectionLayer: 'primary',
  noSignal: false,
  tiebreakUsed: false,
  eligible: 0,
  total: requestedN,
  requestedN,
  failureCause: FAILURE_CAUSE.EXTERNAL_DISPATCH_REFUSED,
  remediationHint: REMEDIATION_HINT.NONE,
  discardedForks: [],
})
