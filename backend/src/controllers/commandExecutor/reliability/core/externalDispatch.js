import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {MCP_PREFIX, RPC_PREFIX} from '../../commands/utils/queryTypeResolver'

// The only knowable fact about a dispatch before it runs: whether it leaves the engine
// for an external system (MCP tool, RPC host, MCP fusion). This is a dispatch-kind
// predicate, not a claim about side effects — the engine cannot prove such a call is
// safe to repeat, so it refuses to fan out over one (see externalDispatchRefusal).
export const isExternalDispatch = ({queryType, mcpAlias, rpcAlias}) =>
  Boolean(mcpAlias) || Boolean(rpcAlias) || queryType === MCP_FUSION_QUERY_TYPE

// Shape-only sibling of isExternalDispatch: an external dispatch is recognisable from the raw
// command's `/mcp:`/`/rpc:` prefix alone, before any alias lookup. The alias-based predicate
// above sees nothing when the alias is unconfigured, so a fan-out over an `/mcp:<name>` term
// would otherwise slip through as unrecognised text; this recognises the dispatch by its shape.
const commandBody = commandText => commandText.trim().replace(/^\//, '')

export const isExternalDispatchShape = commandText =>
  Boolean(commandText) &&
  (commandBody(commandText).startsWith(MCP_PREFIX) || commandBody(commandText).startsWith(RPC_PREFIX))
