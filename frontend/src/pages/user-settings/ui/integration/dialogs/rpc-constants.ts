export const RPC_PROTOCOLS = ['ssh', 'http', 'acp-local'] as const
export const RPC_METHODS = ['GET', 'POST', 'PUT'] as const
export const RPC_OUTPUT_FORMATS = ['text', 'json'] as const
export const ACP_AUTO_APPROVE_OPTIONS = ['all', 'none', 'whitelist'] as const

export type RPCProtocol = (typeof RPC_PROTOCOLS)[number]
export type HTTPMethod = (typeof RPC_METHODS)[number]
export type OutputFormat = (typeof RPC_OUTPUT_FORMATS)[number]
export type AutoApprove = (typeof ACP_AUTO_APPROVE_OPTIONS)[number]
