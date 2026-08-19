/**
 * @typedef {Object} LeafOutput
 * @property {string} nodeId
 * @property {string} content - capped at LEAF_PREVIEW_MAX_CHARS
 * @property {string} [executionStatus]
 * @property {boolean} [isError]
 * @property {number} [httpStatus]
 * @property {number} [exitCode]
 */

export const LEAF_PREVIEW_MAX_CHARS = 500

// synchronous by design — called before fork result dispatch; no async I/O
// [] means no prompt-producing nodes in the fork — callers treat as "no preview available"
export function extractForkLeafOutputs(forkStore, parentNodeId) {
  if (!forkStore) return []
  const parentNode = forkStore.getNode(parentNodeId)
  if (!parentNode) return []
  return (parentNode.prompts ?? [])
    .map(id => forkStore.getNode(id))
    .filter(node => node?.title)
    .map(node => ({
      nodeId: node.id,
      content: node.title.slice(0, LEAF_PREVIEW_MAX_CHARS),
      ...(node.executionStatus ? {executionStatus: node.executionStatus} : {}),
      ...(typeof node.isError === 'boolean' ? {isError: node.isError} : {}),
      ...(Number.isInteger(node.httpStatus) ? {httpStatus: node.httpStatus} : {}),
      ...(Number.isInteger(node.exitCode) ? {exitCode: node.exitCode} : {}),
    }))
}
