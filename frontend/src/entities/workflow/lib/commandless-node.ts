import type { NodeData, NodeId } from '@shared/base-types'
import { isPromptNode } from './node-validation'

const PARAGRAPH_BREAK = /\n\n/

export function isCommandlessTextNode(node: NodeData): boolean {
  return !node.command?.trim() && PARAGRAPH_BREAK.test(node.title ?? '')
}

export function hasOnlyPromptChildren(nodeId: NodeId, nodes: Record<NodeId, NodeData>): boolean {
  const node = nodes[nodeId]
  if (!node) return false
  return (node.children ?? []).every(childId => isPromptNode(childId, nodes))
}
