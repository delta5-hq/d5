export const EXECUTION_NODE_STATUS = Object.freeze({
  ERROR: 'error',
})

export const EXECUTION_FAILURE_TYPE = Object.freeze({
  MCP_TOOL_ERROR: 'mcp-tool-error',
  HTTP_STATUS_ERROR: 'http-status-error',
  SSH_EXIT_ERROR: 'ssh-exit-error',
  RUNTIME_ERROR: 'runtime-error',
})

export const withExecutionErrorStatus = node => ({
  ...node,
  executionStatus: EXECUTION_NODE_STATUS.ERROR,
})

export const withExecutionFailureSignal = (node, signal = null) => ({
  ...withExecutionErrorStatus(node),
  ...(signal?.type ? {executionFailureType: signal.type} : {}),
  ...(signal?.code !== undefined ? {executionFailureCode: signal.code} : {}),
})

export const isExecutionErrorNode = node => node?.executionStatus === EXECUTION_NODE_STATUS.ERROR
