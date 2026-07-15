import {isAbortError} from '../utils/executionSignal'

export const runWithErrorNode = async (store, node, logError, fn) => {
  try {
    return await fn()
  } catch (e) {
    if (isAbortError(e)) {
      throw e
    }

    logError(e)
    const message = e instanceof Error ? e.message : String(e)
    store.importer.createErrorNode(`Error: ${message || 'Unknown error'}`, node.id)
  }
}
