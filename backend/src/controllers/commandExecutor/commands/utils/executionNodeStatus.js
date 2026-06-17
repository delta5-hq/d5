export const EXECUTION_NODE_STATUS = Object.freeze({
  ERROR: 'error',
})

export const withExecutionErrorStatus = node => ({
  ...node,
  executionStatus: EXECUTION_NODE_STATUS.ERROR,
})

export const isExecutionErrorNode = node => node?.executionStatus === EXECUTION_NODE_STATUS.ERROR
