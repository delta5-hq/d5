import Store from '../../commands/utils/Store'
import ImportHandler from '../../commands/utils/ImportHandler'

/**
 * Provides isolated Store snapshots for candidate execution
 * Each fork maintains full isolation to prevent cross-candidate mutation
 */
class StoreFork {
  /**
   * Deep clone helper for Node < 17 environments
   * @private
   */
  static deepClone(obj) {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj)
    }
    return JSON.parse(JSON.stringify(obj))
  }

  /**
   * Create isolated deep clone of Store state
   *
   * @param {Store} sourceStore
   * @returns {Store}
   */
  static createFork(sourceStore) {
    const forked = new Store({
      userId: sourceStore._userId,
      workflowId: sourceStore._workflowId,
      nodes: this.deepClone(sourceStore._nodes),
      edges: this.deepClone(sourceStore._edges),
      files: this.deepClone(sourceStore._files),
    })

    return forked
  }

  /**
   * Merge winning candidate's output into target store
   * Only transfers newly created nodes/edges/files to preserve concurrent mutations
   *
   * @param {Store} targetStore
   * @param {Store} candidateStore
   * @param {string} cellId - The command cell that produced the output
   */
  static applyCandidate(targetStore, candidateStore, cellId) {
    for (const nodeId of candidateStore._output.nodes) {
      const node = candidateStore._nodes[nodeId]
      if (node) {
        targetStore._nodes[nodeId] = node
        targetStore.saveNodeToOutput(nodeId)
      }
    }

    for (const edgeId of candidateStore._output.edges) {
      const edge = candidateStore._edges[edgeId]
      if (edge) {
        targetStore._edges[edgeId] = edge
        targetStore.saveEdgeToOutput(edgeId)
      }
    }

    for (const [fileId, content] of Object.entries(candidateStore._files)) {
      if (!targetStore._files[fileId]) {
        targetStore._files[fileId] = content
      }
    }

    const cellNode = candidateStore._nodes[cellId]
    if (cellNode) {
      targetStore._nodes[cellId] = cellNode
    }

    targetStore.importer = new ImportHandler(targetStore)
  }
}

export default StoreFork
