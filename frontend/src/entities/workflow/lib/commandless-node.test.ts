import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import { isCommandlessTextNode } from './commandless-node'

function node(id: string, overrides: Partial<NodeData> = {}): NodeData {
  return { id, title: '', children: [], ...overrides }
}

describe('isCommandlessTextNode', () => {
  describe('positive cases', () => {
    it('returns true for a node with no command and multi-paragraph title', () => {
      expect(isCommandlessTextNode(node('a', { title: 'Para 1\n\nPara 2' }))).toBe(true)
    })

    it('returns true when command is empty string', () => {
      expect(isCommandlessTextNode(node('a', { command: '', title: 'A\n\nB' }))).toBe(true)
    })

    it('returns true when command is only whitespace', () => {
      expect(isCommandlessTextNode(node('a', { command: '   ', title: 'A\n\nB' }))).toBe(true)
    })

    it('returns true for three or more paragraphs', () => {
      expect(isCommandlessTextNode(node('a', { title: 'A\n\nB\n\nC' }))).toBe(true)
    })

    it.each([
      ['LF', '\n\n'],
      ['CRLF', '\r\n\r\n'],
      ['bare CR', '\r\r'],
      ['mixed CRLF and CR', '\r\n\r'],
    ])('returns true for a blank line encoded with %s endings', (_encoding, paragraphBreak) => {
      expect(isCommandlessTextNode(node('a', { title: `A${paragraphBreak}B` }))).toBe(true)
    })

    it('returns true when the blank line contains whitespace', () => {
      expect(isCommandlessTextNode(node('a', { title: 'A\n \t\u00a0\nB' }))).toBe(true)
    })
  })

  describe('negative cases', () => {
    it('returns false when node has a command', () => {
      expect(isCommandlessTextNode(node('a', { command: '/chat', title: 'A\n\nB' }))).toBe(false)
    })

    it('returns false when title has no paragraph break', () => {
      expect(isCommandlessTextNode(node('a', { title: 'single paragraph' }))).toBe(false)
    })

    it.each([
      ['LF', '\n'],
      ['CRLF', '\r\n'],
      ['bare CR', '\r'],
    ])('returns false when title uses a single %s line ending', (_encoding, lineBreak) => {
      expect(isCommandlessTextNode(node('a', { title: `A${lineBreak}B` }))).toBe(false)
    })

    it('returns false when title is empty', () => {
      expect(isCommandlessTextNode(node('a', { title: '' }))).toBe(false)
    })

    it('returns false when title is undefined', () => {
      expect(isCommandlessTextNode(node('a', { title: undefined }))).toBe(false)
    })
  })
})
