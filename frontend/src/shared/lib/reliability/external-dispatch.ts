// Mirror of backend reliability/core/externalDispatch.js isExternalDispatchShape. An external
// dispatch is recognisable from the raw command's `/mcp:`/`/rpc:` prefix alone, before any alias
// lookup, so `/elect` and `/refine` refuse to fan out over one by its shape even when the alias is
// unconfigured — the term is an external dispatch, never the criterion text the validator rejects.
export const MCP_PREFIX = 'mcp:'
export const RPC_PREFIX = 'rpc:'

const commandBody = (commandText: string): string => commandText.trim().replace(/^\//, '')

export const isExternalDispatchShape = (commandText: string | undefined): boolean =>
  Boolean(commandText) &&
  (commandBody(commandText as string).startsWith(MCP_PREFIX) ||
    commandBody(commandText as string).startsWith(RPC_PREFIX))
