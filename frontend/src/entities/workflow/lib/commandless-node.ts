import type { NodeData } from '@shared/base-types'

const BLANK_LINE_BREAK = /\n[^\S\n]*\n/
const INDENTED_LINE = /\n[^\S\n]+/
const normalizeLineEndings = (text: string): string => text.replace(/\r\n|\r/g, '\n')

export function isCommandlessTextNode(node: NodeData): boolean {
  if (node.command?.trim()) return false
  const title = normalizeLineEndings(node.title ?? '')
  return BLANK_LINE_BREAK.test(title) || INDENTED_LINE.test(title)
}
