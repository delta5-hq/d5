import type { NodeData } from '@shared/base-types'

const PARAGRAPH_BREAK = /\n\n/

export function isCommandlessTextNode(node: NodeData): boolean {
  return !node.command?.trim() && PARAGRAPH_BREAK.test(node.title ?? '')
}
