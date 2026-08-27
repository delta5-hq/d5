import {isAbortError} from '../utils/executionSignal'
import {EXECUTION_FAILURE_TYPE} from '../utils/executionNodeStatus'

export const runWithErrorNode = async (store, node, logError, fn, options = {}) => {
  try {
    return await fn()
  } catch (e) {
    if (isAbortError(e)) {
      throw e
    }

    logError(e)
    const failureSignal = options.classifyError?.(e)
    const rawMessage = e instanceof Error ? e.message : String(e)
    const message = options.publicMessage?.(e) ?? rawMessage
    if (failureSignal) {
      store.importer.createErrorNode(`Error: ${message || 'Unknown error'}`, node.id, failureSignal)
    } else {
      // Preserve the established ImportHandler call contract for generic commands
      // while still persisting a typed runtime signal on the real created node.
      const errorNode = store.importer.createErrorNode(`Error: ${message || 'Unknown error'}`, node.id)
      if (errorNode) errorNode.executionFailureType = EXECUTION_FAILURE_TYPE.RUNTIME_ERROR
    }
  }
}
