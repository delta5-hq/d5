import Store from '../../commands/utils/Store'
import ImportHandler from '../../commands/utils/ImportHandler'

class StoreFork {
  static FORK_WARN_THRESHOLD = 500

  /** @private */
  static deepClone(obj) {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj)
    }
    return JSON.parse(JSON.stringify(obj))
  }

  static createFork(sourceStore) {
    const nodeCount = Object.keys(sourceStore._nodes).length
    if (nodeCount > StoreFork.FORK_WARN_THRESHOLD) {
      console.warn(`[StoreFork] Forking store with ${nodeCount} nodes. Deep clone may use significant memory.`)
    }
    const forked = new Store({
      userId: sourceStore._userId,
      workflowId: sourceStore._workflowId,
      nodes: this.deepClone(sourceStore._nodes),
      edges: this.deepClone(sourceStore._edges),
      files: this.deepClone(sourceStore._files),
    })

    return forked
  }

  // Only transfers newly created nodes/edges/files to preserve concurrent mutations
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
