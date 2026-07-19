import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import { isCommandlessTextNode, hasOnlyPromptChildren } from './commandless-node'

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
  })

  describe('negative cases', () => {
    it('returns false when node has a command', () => {
      expect(isCommandlessTextNode(node('a', { command: '/chat', title: 'A\n\nB' }))).toBe(false)
    })

    it('returns false when title has no paragraph break', () => {
      expect(isCommandlessTextNode(node('a', { title: 'single paragraph' }))).toBe(false)
    })

    it('returns false when title uses single newline (not double)', () => {
      expect(isCommandlessTextNode(node('a', { title: 'A\nB' }))).toBe(false)
    })

    it('returns false when title is empty', () => {
      expect(isCommandlessTextNode(node('a', { title: '' }))).toBe(false)
    })

    it('returns false when title is undefined', () => {
      expect(isCommandlessTextNode(node('a', { title: undefined }))).toBe(false)
    })
  })
})

describe('hasOnlyPromptChildren', () => {
  it('returns true when all children are in the parent prompts list', () => {
    const nodes = {
      parent: node('parent', { children: ['p1', 'p2'], prompts: ['p1', 'p2'] }),
      p1: node('p1', { parent: 'parent' }),
      p2: node('p2', { parent: 'parent' }),
    }
    expect(hasOnlyPromptChildren('parent', nodes)).toBe(true)
  })

  it('returns true when children list is empty', () => {
    const nodes = { parent: node('parent', { children: [] }) }
    expect(hasOnlyPromptChildren('parent', nodes)).toBe(true)
  })

  it('returns false when at least one child is not a prompt', () => {
    const nodes = {
      parent: node('parent', { children: ['c1', 'p1'], prompts: ['p1'] }),
      c1: node('c1', { parent: 'parent' }),
      p1: node('p1', { parent: 'parent' }),
    }
    expect(hasOnlyPromptChildren('parent', nodes)).toBe(false)
  })

  it('returns false when no children are prompts', () => {
    const nodes = {
      parent: node('parent', { children: ['c1'] }),
      c1: node('c1', { parent: 'parent' }),
    }
    expect(hasOnlyPromptChildren('parent', nodes)).toBe(false)
  })

  it('returns false when parent node does not exist', () => {
    expect(hasOnlyPromptChildren('nonexistent', {})).toBe(false)
  })
})
