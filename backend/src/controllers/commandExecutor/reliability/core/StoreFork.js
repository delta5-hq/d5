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

    forked.withinForkExecution = true
    return forked
  }

  /**
   * Transfer the complete subtree rooted at `cellId` from `candidateStore`
   * into `targetStore`, replacing the target's version of that region.
   *
   * All nodes reachable from `cellId` via children/prompts are transferred,
   * plus any edges that connect nodes within the subtree.
   * Files present in candidateStore but absent in targetStore are added.
   * The `cellId` node itself is always synced (title, children, prompts, metadata).
   *
   * @param {Store} targetStore
   * @param {Store} candidateStore
   * @param {string} cellId - Root of the subtree to transfer
   */
  static applyCandidate(targetStore, candidateStore, cellId) {
    // Collect all node IDs reachable from cellId in candidateStore
    const subtreeIds = new Set()
    const walk = nodeId => {
      if (subtreeIds.has(nodeId)) return
      const node = candidateStore._nodes[nodeId]
      if (!node) return
      subtreeIds.add(nodeId)
      for (const childId of node.children ?? []) walk(childId)
      for (const promptId of node.prompts ?? []) walk(promptId)
    }
    walk(cellId)

    // Transfer all subtree nodes
    for (const nodeId of subtreeIds) {
      const node = candidateStore._nodes[nodeId]
      if (node) {
        targetStore._nodes[nodeId] = node
        targetStore.saveNodeToOutput(nodeId)
      }
    }

    // Transfer edges that touch any subtree node
    for (const [edgeId, edge] of Object.entries(candidateStore._edges)) {
      if (subtreeIds.has(edge.start) || subtreeIds.has(edge.end)) {
        targetStore._edges[edgeId] = edge
        targetStore.saveEdgeToOutput(edgeId)
      }
    }

    // Transfer new files (do not overwrite existing)
    for (const [fileId, content] of Object.entries(candidateStore._files)) {
      if (!targetStore._files[fileId]) {
        targetStore._files[fileId] = content
      }
    }

    targetStore.importer = new ImportHandler(targetStore)
  }
}

export default StoreFork
