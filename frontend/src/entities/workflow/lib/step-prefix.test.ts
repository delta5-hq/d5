import { describe, it, expect } from 'vitest'
import type { NodeData } from '@shared/base-types'
import {
  isStepsNode,
  parseStepIndex,
  stripStepPrefix,
  applyStepPrefix,
  sortChildrenByStepPrefix,
  applySequentialPrefixes,
  reorderAndRenumberStepsChildren,
} from './step-prefix'

function node(id: string, overrides: Partial<NodeData> = {}): NodeData {
  return { id, title: '', children: [], ...overrides }
}

function stepsTree(childTitles: string[]): Record<string, NodeData> {
  const children = childTitles.map((_, i) => `c${i + 1}`)
  return {
    parent: node('parent', { command: '/steps', children }),
    ...Object.fromEntries(children.map((id, i) => [id, node(id, { title: childTitles[i], parent: 'parent' })])),
  }
}

describe('step-prefix', () => {
  describe('isStepsNode', () => {
    describe('command matching', () => {
      it('returns true for exact /steps command', () => {
        expect(isStepsNode(node('x', { command: '/steps' }))).toBe(true)
      })

      it('returns false for /foreach', () => {
        expect(isStepsNode(node('x', { command: '/foreach' }))).toBe(false)
      })

      it('returns false for /chat', () => {
        expect(isStepsNode(node('x', { command: '/chat' }))).toBe(false)
      })

      it('returns false for partial match like /steps-foo', () => {
        expect(isStepsNode(node('x', { command: '/steps-foo' }))).toBe(false)
      })
    })

    describe('absent or empty command', () => {
      it('returns false when command is undefined', () => {
        expect(isStepsNode(node('x', { command: undefined }))).toBe(false)
      })

      it('returns false when command is empty string', () => {
        expect(isStepsNode(node('x', { command: '' }))).toBe(false)
      })

      it('returns false when command is only whitespace', () => {
        expect(isStepsNode(node('x', { command: '   ' }))).toBe(false)
      })
    })

    describe('whitespace tolerance', () => {
      it('trims leading whitespace', () => {
        expect(isStepsNode(node('x', { command: '  /steps' }))).toBe(true)
      })

      it('trims trailing whitespace', () => {
        expect(isStepsNode(node('x', { command: '/steps  ' }))).toBe(true)
      })

      it('trims both sides', () => {
        expect(isStepsNode(node('x', { command: '  /steps  ' }))).toBe(true)
      })
    })
  })

  describe('parseStepIndex', () => {
    describe('valid prefixes', () => {
      it('extracts 1', () => expect(parseStepIndex('#1 foo')).toBe(1))
      it('extracts 2', () => expect(parseStepIndex('#2 bar')).toBe(2))
      it('extracts multi-digit index', () => expect(parseStepIndex('#42 bar')).toBe(42))
      it('extracts three-digit index', () => expect(parseStepIndex('#100 item')).toBe(100))
      it('extracts #0 (valid per regex, renumbered by algorithm)', () => expect(parseStepIndex('#0 zero')).toBe(0))
      it('extracts index when no space follows', () => expect(parseStepIndex('#3foo')).toBe(3))
      it('extracts index when nothing follows', () => expect(parseStepIndex('#1')).toBe(1))
    })

    describe('absent or invalid prefixes', () => {
      it('returns null for plain title', () => expect(parseStepIndex('plain title')).toBeNull())
      it('returns null for empty string', () => expect(parseStepIndex('')).toBeNull())
      it('returns null when # is not at start', () => expect(parseStepIndex('foo #1')).toBeNull())
      it('returns null for leading whitespace before #', () => expect(parseStepIndex('  #1 foo')).toBeNull())
      it('returns null for # with no digits', () => expect(parseStepIndex('# foo')).toBeNull())
      it('returns null for negative-looking prefix', () => expect(parseStepIndex('#-1 foo')).toBeNull())
    })
  })

  describe('stripStepPrefix', () => {
    describe('prefix removal', () => {
      it('strips single-digit prefix and space', () => expect(stripStepPrefix('#1 hello')).toBe('hello'))
      it('strips multi-digit prefix', () => expect(stripStepPrefix('#12 item')).toBe('item'))
      it('strips all leading spaces after the digits', () =>
        expect(stripStepPrefix('#1   triple space')).toBe('triple space'))
      it('returns empty string when title is only a prefix', () => expect(stripStepPrefix('#1')).toBe(''))
      it('returns empty string for prefix with trailing space only', () => expect(stripStepPrefix('#1 ')).toBe(''))
    })

    describe('titles without prefix', () => {
      it('leaves plain title unchanged', () => expect(stripStepPrefix('plain')).toBe('plain'))
      it('leaves empty string unchanged', () => expect(stripStepPrefix('')).toBe(''))
      it('leaves mid-string # unchanged', () => expect(stripStepPrefix('foo #1 bar')).toBe('foo #1 bar'))
    })
  })

  describe('applyStepPrefix', () => {
    describe('prefix application', () => {
      it('prepends #N to plain title', () => expect(applyStepPrefix('foo', 1)).toBe('#1 foo'))
      it('prepends #N with large index', () => expect(applyStepPrefix('foo', 100)).toBe('#100 foo'))
      it('replaces existing lower prefix with higher', () => expect(applyStepPrefix('#1 foo', 5)).toBe('#5 foo'))
      it('replaces existing higher prefix with lower', () => expect(applyStepPrefix('#5 foo', 2)).toBe('#2 foo'))
    })

    describe('idempotency and round-trip', () => {
      it('is idempotent: applying same number twice is identity', () => {
        const title = 'foo bar'
        expect(applyStepPrefix(applyStepPrefix(title, 3), 3)).toBe(applyStepPrefix(title, 3))
      })

      it('strip then apply equals apply directly', () => {
        const title = '#7 some text'
        expect(applyStepPrefix(stripStepPrefix(title), 2)).toBe(applyStepPrefix(title, 2))
      })
    })
  })

  describe('sortChildrenByStepPrefix', () => {
    describe('ordering by #N', () => {
      it('sorts three elements ascending', () => {
        const nodes = {
          a: node('a', { title: '#3 third' }),
          b: node('b', { title: '#1 first' }),
          c: node('c', { title: '#2 second' }),
        }
        expect(sortChildrenByStepPrefix(['a', 'b', 'c'], nodes)).toEqual(['b', 'c', 'a'])
      })

      it('handles already-sorted input without change', () => {
        const nodes = {
          a: node('a', { title: '#1 first' }),
          b: node('b', { title: '#2 second' }),
          c: node('c', { title: '#3 third' }),
        }
        expect(sortChildrenByStepPrefix(['a', 'b', 'c'], nodes)).toEqual(['a', 'b', 'c'])
      })

      it('places unprefixed nodes after all prefixed ones', () => {
        const nodes = {
          a: node('a', { title: '#2 b' }),
          b: node('b', { title: 'no prefix' }),
          c: node('c', { title: '#1 a' }),
        }
        expect(sortChildrenByStepPrefix(['a', 'b', 'c'], nodes)).toEqual(['c', 'a', 'b'])
      })

      it('preserves relative order among multiple unprefixed nodes', () => {
        const nodes = {
          a: node('a', { title: 'first unprefixed' }),
          b: node('b', { title: 'second unprefixed' }),
          c: node('c', { title: '#1 prefixed' }),
        }
        expect(sortChildrenByStepPrefix(['a', 'b', 'c'], nodes)).toEqual(['c', 'a', 'b'])
      })
    })

    describe('stability', () => {
      it('breaks ties by original position (lower index wins)', () => {
        const nodes = {
          a: node('a', { title: '#1 first-original' }),
          b: node('b', { title: '#1 second-original' }),
        }
        expect(sortChildrenByStepPrefix(['a', 'b'], nodes)).toEqual(['a', 'b'])
      })

      it('breaks ties by original position in reverse input order', () => {
        const nodes = {
          a: node('a', { title: '#1 second-original' }),
          b: node('b', { title: '#1 first-original' }),
        }
        expect(sortChildrenByStepPrefix(['b', 'a'], nodes)).toEqual(['b', 'a'])
      })
    })

    describe('edge cases', () => {
      it('returns empty array for empty children', () => {
        expect(sortChildrenByStepPrefix([], {})).toEqual([])
      })

      it('returns single element unchanged', () => {
        const nodes = { a: node('a', { title: '#5 only' }) }
        expect(sortChildrenByStepPrefix(['a'], nodes)).toEqual(['a'])
      })

      it('treats unknown node ID (not in map) as unprefixed', () => {
        const nodes = {
          a: node('a', { title: '#1 known' }),
        }
        expect(sortChildrenByStepPrefix(['unknown', 'a'], nodes)).toEqual(['a', 'unknown'])
      })
    })
  })

  describe('applySequentialPrefixes', () => {
    describe('sequential numbering', () => {
      it('numbers a single child as #1', () => {
        const nodes: Record<string, NodeData> = {
          parent: node('parent', { command: '/steps', children: ['c1'] }),
          c1: node('c1', { title: 'only', parent: 'parent' }),
        }
        expect(applySequentialPrefixes(nodes, 'parent').c1.title).toBe('#1 only')
      })

      it('numbers three children 1-based in children-array order', () => {
        const nodes: Record<string, NodeData> = {
          parent: node('parent', { command: '/steps', children: ['c1', 'c2', 'c3'] }),
          c1: node('c1', { title: 'first', parent: 'parent' }),
          c2: node('c2', { title: 'second', parent: 'parent' }),
          c3: node('c3', { title: 'third', parent: 'parent' }),
        }
        const result = applySequentialPrefixes(nodes, 'parent')
        expect(result.c1.title).toBe('#1 first')
        expect(result.c2.title).toBe('#2 second')
        expect(result.c3.title).toBe('#3 third')
      })

      it('replaces existing prefix when renumbering', () => {
        const nodes: Record<string, NodeData> = {
          parent: node('parent', { command: '/steps', children: ['c1', 'c2'] }),
          c1: node('c1', { title: '#5 was-five', parent: 'parent' }),
          c2: node('c2', { title: '#3 was-three', parent: 'parent' }),
        }
        const result = applySequentialPrefixes(nodes, 'parent')
        expect(result.c1.title).toBe('#1 was-five')
        expect(result.c2.title).toBe('#2 was-three')
      })

      it('skips child IDs that are not in the nodes map', () => {
        const nodes: Record<string, NodeData> = {
          parent: node('parent', { command: '/steps', children: ['c1', 'missing', 'c2'] }),
          c1: node('c1', { title: 'first', parent: 'parent' }),
          c2: node('c2', { title: 'third', parent: 'parent' }),
        }
        const result = applySequentialPrefixes(nodes, 'parent')
        expect(result.c1.title).toBe('#1 first')
        expect(result.c2.title).toBe('#3 third')
      })
    })

    describe('no-op conditions', () => {
      it('returns same reference for non-/steps parent', () => {
        const nodes = {
          parent: node('parent', { command: '/chat', children: ['c1'] }),
          c1: node('c1', { title: 'item', parent: 'parent' }),
        }
        expect(applySequentialPrefixes(nodes, 'parent')).toBe(nodes)
      })

      it('returns same reference for /steps parent with empty children', () => {
        const nodes = {
          parent: node('parent', { command: '/steps', children: [] }),
        }
        expect(applySequentialPrefixes(nodes, 'parent')).toBe(nodes)
      })

      it('returns same reference for unknown parentId', () => {
        const nodes = { other: node('other') }
        expect(applySequentialPrefixes(nodes, 'nonexistent')).toBe(nodes)
      })
    })

    describe('immutability', () => {
      it('does not modify the input nodes object', () => {
        const nodes: Record<string, NodeData> = {
          parent: node('parent', { command: '/steps', children: ['c1'] }),
          c1: node('c1', { title: 'original', parent: 'parent' }),
        }
        const originalTitle = nodes.c1.title
        applySequentialPrefixes(nodes, 'parent')
        expect(nodes.c1.title).toBe(originalTitle)
      })

      it('does not modify the input child node object', () => {
        const nodes: Record<string, NodeData> = {
          parent: node('parent', { command: '/steps', children: ['c1'] }),
          c1: node('c1', { title: 'original', parent: 'parent' }),
        }
        const originalChild = nodes.c1
        applySequentialPrefixes(nodes, 'parent')
        expect(nodes.c1).toBe(originalChild)
      })
    })
  })

  describe('reorderAndRenumberStepsChildren', () => {
    describe('reorder then renumber', () => {
      it('sorts children by #N and renumbers sequentially', () => {
        const nodes = stepsTree(['#3 third', '#1 first', '#2 second'])
        const result = reorderAndRenumberStepsChildren(nodes, 'parent')
        expect(result.parent.children).toEqual(['c2', 'c3', 'c1'])
        expect(result.c2.title).toBe('#1 first')
        expect(result.c3.title).toBe('#2 second')
        expect(result.c1.title).toBe('#3 third')
      })

      it('collapses gap prefixes to sequential order', () => {
        const nodes = stepsTree(['#1 aaa', '#2 bbb', '#5 ccc'])
        const result = reorderAndRenumberStepsChildren(nodes, 'parent')
        expect(result.parent.children).toEqual(['c1', 'c2', 'c3'])
        expect(result.c1.title).toBe('#1 aaa')
        expect(result.c2.title).toBe('#2 bbb')
        expect(result.c3.title).toBe('#3 ccc')
      })

      it('handles all unprefixed children by assigning sequential order', () => {
        const nodes = stepsTree(['alpha', 'beta', 'gamma'])
        const result = reorderAndRenumberStepsChildren(nodes, 'parent')
        expect(result.parent.children).toEqual(['c1', 'c2', 'c3'])
        expect(result.c1.title).toBe('#1 alpha')
        expect(result.c2.title).toBe('#2 beta')
        expect(result.c3.title).toBe('#3 gamma')
      })

      it('handles a single child', () => {
        const nodes = stepsTree(['#5 only'])
        const result = reorderAndRenumberStepsChildren(nodes, 'parent')
        expect(result.parent.children).toEqual(['c1'])
        expect(result.c1.title).toBe('#1 only')
      })

      it('renumbers #0-prefixed child to #1', () => {
        const nodes = stepsTree(['#0 zero', '#1 one'])
        const result = reorderAndRenumberStepsChildren(nodes, 'parent')
        expect(result.c1.title).toBe('#1 zero')
        expect(result.c2.title).toBe('#2 one')
      })
    })

    describe('idempotency', () => {
      it('applying twice produces the same result as applying once', () => {
        const nodes = stepsTree(['#3 c', '#1 a', '#2 b'])
        const once = reorderAndRenumberStepsChildren(nodes, 'parent')
        const twice = reorderAndRenumberStepsChildren(once, 'parent')
        expect(twice.parent.children).toEqual(once.parent.children)
        for (const id of once.parent.children ?? []) {
          expect(twice[id].title).toBe(once[id].title)
        }
      })
    })

    describe('no-op conditions', () => {
      it('returns same reference for non-/steps parent', () => {
        const nodes = {
          parent: node('parent', { command: '/chat', children: ['c1'] }),
          c1: node('c1', { title: '#5 item', parent: 'parent' }),
        }
        expect(reorderAndRenumberStepsChildren(nodes, 'parent')).toBe(nodes)
      })

      it('returns same reference for unknown parentId', () => {
        const nodes = { other: node('other') }
        expect(reorderAndRenumberStepsChildren(nodes, 'nonexistent')).toBe(nodes)
      })
    })
  })
})
