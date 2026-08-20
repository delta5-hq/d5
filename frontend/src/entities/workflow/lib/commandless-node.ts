import type { NodeData } from '@shared/base-types'

const BLANK_LINE_BREAK = /\n[^\S\n]*\n/
const normalizeLineEndings = (text: string): string => text.replace(/\r\n|\r/g, '\n')

export function isCommandlessTextNode(node: NodeData): boolean {
  return !node.command?.trim() && BLANK_LINE_BREAK.test(normalizeLineEndings(node.title ?? ''))
}
