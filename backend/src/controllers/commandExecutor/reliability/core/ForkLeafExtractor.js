/**
 * @typedef {Object} LeafOutput
 * @property {string} nodeId
 * @property {string} content - capped at LEAF_PREVIEW_MAX_CHARS
 * @property {string} [executionStatus]
 * @property {string} [executionFailureType]
 * @property {number|string} [executionFailureCode]
 */

export const LEAF_PREVIEW_MAX_CHARS = 500

// A single-command term attaches its output to the parent's own prompts; a /steps term produces no
// direct prompt, its outputs live on the step nodes. Collecting the subtree's prompt nodes covers
// both without the extractor needing to know which term shape produced the fork.
function collectSubtreePromptIds(forkStore, parentNode) {
  const promptIds = []
  const visited = new Set()
  const stack = [...(parentNode.children ?? [])]
  while (stack.length > 0) {
    const nodeId = stack.pop()
    if (visited.has(nodeId)) continue
    visited.add(nodeId)
    const node = forkStore.getNode(nodeId)
    if (!node) continue
    promptIds.push(...(node.prompts ?? []))
    stack.push(...(node.children ?? []))
  }
  return promptIds
}

// synchronous by design — called before fork result dispatch; no async I/O
// [] means no prompt-producing nodes in the fork — callers treat as "no preview available"
export function extractForkLeafOutputs(forkStore, parentNodeId) {
  if (!forkStore) return []
  const parentNode = forkStore.getNode(parentNodeId)
  if (!parentNode) return []
  const promptIds = parentNode.prompts?.length ? parentNode.prompts : collectSubtreePromptIds(forkStore, parentNode)
  return promptIds
    .map(id => forkStore.getNode(id))
    .filter(node => node?.title)
    .map(node => ({
      nodeId: node.id,
      content: node.title.slice(0, LEAF_PREVIEW_MAX_CHARS),
      ...(node.executionStatus ? {executionStatus: node.executionStatus} : {}),
      ...(node.executionFailureType ? {executionFailureType: node.executionFailureType} : {}),
      ...(node.executionFailureCode !== undefined ? {executionFailureCode: node.executionFailureCode} : {}),
    }))
}
