export const runWithErrorNode = async (store, node, logError, fn) => {
  try {
    return await fn()
  } catch (e) {
    logError(e)
    const message = e instanceof Error ? e.message : String(e)
    store.importer.createNodes(`Error: ${message || 'Unknown error'}`, node.id)
  }
}
