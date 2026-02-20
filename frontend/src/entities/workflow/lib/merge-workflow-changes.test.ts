import { describe, it, expect } from 'vitest'
import { mergeWorkflowChanges } from './merge-workflow-changes'
import type { WorkflowContentData, NodeData, EdgeData } from '@shared/base-types'
import { AccessRole } from '@shared/base-types'

const createState = (nodes: Record<string, NodeData>, root = Object.keys(nodes)[0] ?? 'root'): WorkflowContentData => ({
  nodes,
  root,
  share: { access: [] },
})

describe('mergeWorkflowChanges', () => {
  describe('pass-through', () => {
    it('returns same reference when changes object is empty', () => {
      const state = createState({ n1: { id: 'n1' } })
      expect(mergeWorkflowChanges(state, {})).toBe(state)
    })

    it('returns same reference when both fields are explicit undefined', () => {
      const state = createState({ n1: { id: 'n1' } })
      expect(mergeWorkflowChanges(state, { nodesChanged: undefined, edgesChanged: undefined })).toBe(state)
    })

    it('returns new reference when nodesChanged is empty record', () => {
      const state = createState({ n1: { id: 'n1' } })
      const result = mergeWorkflowChanges(state, { nodesChanged: {} })
      expect(result).not.toBe(state)
      expect(result.nodes).toEqual(state.nodes)
    })

    it('returns new reference when edgesChanged is empty record', () => {
      const edges = { e1: { id: 'e1', start: 'a', end: 'b' } as EdgeData }
      const state: WorkflowContentData = { ...createState({ n1: { id: 'n1' } }), edges }
      const result = mergeWorkflowChanges(state, { edgesChanged: {} })
      expect(result).not.toBe(state)
      expect(result.edges).toEqual(edges)
    })
  })

  describe('node merging', () => {
    it('adds new node to state', () => {
      const state = createState({ n1: { id: 'n1' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n2: { id: 'n2', title: 'New' } },
      })

      expect(result.nodes.n2).toEqual({ id: 'n2', title: 'New' })
      expect(result.nodes.n1).toEqual({ id: 'n1' })
    })

    it('updates existing node fields', () => {
      const state = createState({ n1: { id: 'n1', title: 'Old' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', title: 'New' } },
      })

      expect(result.nodes.n1.title).toBe('New')
    })

    it('preserves untouched nodes in partial update', () => {
      const state = createState({
        n1: { id: 'n1', title: 'One' },
        n2: { id: 'n2', title: 'Two' },
        n3: { id: 'n3', title: 'Three' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n2: { id: 'n2', title: 'Updated' } },
      })

      expect(result.nodes.n1).toEqual(state.nodes.n1)
      expect(result.nodes.n3).toEqual(state.nodes.n3)
      expect(result.nodes.n2.title).toBe('Updated')
    })

    it('handles batch of mixed new and existing nodes', () => {
      const state = createState({
        n1: { id: 'n1', title: 'One' },
        n2: { id: 'n2', title: 'Two' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          n1: { id: 'n1', title: 'Updated' },
          n3: { id: 'n3', title: 'Brand New' },
        },
      })

      expect(result.nodes.n1.title).toBe('Updated')
      expect(result.nodes.n2.title).toBe('Two')
      expect(result.nodes.n3.title).toBe('Brand New')
    })

    it('inserts node with all optional fields', () => {
      const node: NodeData = {
        id: 'full',
        title: 'Full Node',
        children: ['c1'],
        prompts: ['p1'],
        color: '#ff0000',
        borderColor: '#00ff00',
        scale: 1.5,
        tags: ['t1'],
        checked: true,
        hasComments: true,
        autoshrink: false,
        dirty: true,
        command: '/instruct test',
        collapsed: false,
        parent: 'root',
      }
      const state = createState({})

      const result = mergeWorkflowChanges(state, { nodesChanged: { full: node } })

      expect(result.nodes.full).toEqual(node)
    })

    it('merges into empty state', () => {
      const state = createState({})

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1' } },
      })

      expect(result.nodes).toEqual({ n1: { id: 'n1' } })
    })

    it('replaces existing node entirely except children union', () => {
      const state = createState({
        n1: { id: 'n1', title: 'Old', color: '#ff0', scale: 2, children: ['c1'] },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', title: 'New', children: ['c2'] } },
      })

      expect(result.nodes.n1.title).toBe('New')
      expect(result.nodes.n1.color).toBeUndefined()
      expect(result.nodes.n1.scale).toBeUndefined()
      expect(result.nodes.n1.children).toEqual(['c1', 'c2'])
    })

    it('preserves root, share, edges, tags, and category', () => {
      const state: WorkflowContentData = {
        nodes: { root: { id: 'root' } },
        root: 'root',
        share: { access: [{ subjectId: 'u1', subjectType: 'user', role: AccessRole.owner }] },
        edges: { e1: { id: 'e1', start: 'a', end: 'b' } },
        tags: [{ id: 't1', name: 'Important', color: '#f00' }],
        category: 'work',
      }

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n2: { id: 'n2' } },
      })

      expect(result.root).toBe('root')
      expect(result.share).toEqual(state.share)
      expect(result.edges).toEqual(state.edges)
      expect(result.tags).toEqual(state.tags)
      expect(result.category).toBe('work')
    })
  })

  describe('children union', () => {
    it('returns incoming as-is when neither side has children', () => {
      const state = createState({ n1: { id: 'n1', title: 'Old' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', title: 'New' } },
      })

      expect(result.nodes.n1.title).toBe('New')
      expect(result.nodes.n1.children).toBeUndefined()
    })

    it('returns incoming children when existing has none', () => {
      const state = createState({ n1: { id: 'n1' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', children: ['c1', 'c2'] } },
      })

      expect(result.nodes.n1.children).toEqual(['c1', 'c2'])
    })

    it('preserves existing children when incoming has empty array', () => {
      const state = createState({ n1: { id: 'n1', children: ['c1', 'c2'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', children: [] } },
      })

      expect(result.nodes.n1.children).toEqual(['c1', 'c2'])
    })

    it('preserves existing children when incoming omits children', () => {
      const state = createState({ n1: { id: 'n1', children: ['c1'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', title: 'Updated' } },
      })

      expect(result.nodes.n1.children).toEqual(['c1'])
      expect(result.nodes.n1.title).toBe('Updated')
    })

    it('unions disjoint children arrays', () => {
      const state = createState({ n1: { id: 'n1', children: ['a', 'b'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', children: ['c', 'd'] } },
      })

      expect(result.nodes.n1.children).toEqual(['a', 'b', 'c', 'd'])
    })

    it('deduplicates overlapping children', () => {
      const state = createState({ n1: { id: 'n1', children: ['a', 'b', 'c'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', children: ['b', 'c', 'd'] } },
      })

      expect(result.nodes.n1.children).toEqual(['a', 'b', 'c', 'd'])
    })

    it('preserves existing-first order with new appended', () => {
      const state = createState({ n1: { id: 'n1', children: ['x', 'y'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', children: ['y', 'z'] } },
      })

      expect(result.nodes.n1.children).toEqual(['x', 'y', 'z'])
    })

    it('returns incoming directly when both sides have empty arrays', () => {
      const state = createState({ n1: { id: 'n1', children: [] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', children: [] } },
      })

      expect(result.nodes.n1.children).toEqual([])
    })

    it('deduplicates pre-existing duplicate entries in children', () => {
      const state = createState({ n1: { id: 'n1', children: ['a', 'a', 'b'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', children: ['b', 'c'] } },
      })

      expect(result.nodes.n1.children).toEqual(['a', 'b', 'c'])
    })
  })

  describe('parent-child reconciliation', () => {
    it('adds incoming child to existing parent.children', () => {
      const state = createState({
        p: { id: 'p', children: ['existing'] },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { c: { id: 'c', parent: 'p' } },
      })

      expect(result.nodes.p.children).toEqual(['existing', 'c'])
    })

    it('initializes parent.children when undefined', () => {
      const state = createState({ p: { id: 'p' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { c: { id: 'c', parent: 'p' } },
      })

      expect(result.nodes.p.children).toEqual(['c'])
    })

    it('adds multiple children to same parent', () => {
      const state = createState({ p: { id: 'p', children: [] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          c1: { id: 'c1', parent: 'p' },
          c2: { id: 'c2', parent: 'p' },
        },
      })

      expect(result.nodes.p.children).toEqual(expect.arrayContaining(['c1', 'c2']))
      expect(result.nodes.p.children).toHaveLength(2)
    })

    it('skips when parent.children already contains child', () => {
      const state = createState({
        p: { id: 'p', children: ['c'] },
        c: { id: 'c', parent: 'p', title: 'Old' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { c: { id: 'c', parent: 'p', title: 'New' } },
      })

      expect(result.nodes.p.children).toEqual(['c'])
      expect(result.nodes.c.title).toBe('New')
    })

    it('skips when parent not in state', () => {
      const state = createState({})

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { orphan: { id: 'orphan', parent: 'missing' } },
      })

      expect(result.nodes.orphan).toEqual({ id: 'orphan', parent: 'missing' })
    })

    it('skips for nodes without parent field', () => {
      const state = createState({ root: { id: 'root' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { root: { id: 'root', title: 'Updated' } },
      })

      expect(result.nodes.root).toEqual({ id: 'root', title: 'Updated' })
    })

    it('handles chained parents in same response', () => {
      const state = createState({ gp: { id: 'gp', children: [] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          p: { id: 'p', parent: 'gp', children: ['c'] },
          c: { id: 'c', parent: 'p' },
        },
      })

      expect(result.nodes.gp.children).toEqual(['p'])
      expect(result.nodes.p.children).toContain('c')
    })

    it('adds self as child when node references itself as parent', () => {
      const state = createState({ n: { id: 'n', children: [] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n: { id: 'n', parent: 'n' } },
      })

      expect(result.nodes.n.children).toEqual(['n'])
    })

    it('skips when child already present via children-union merge', () => {
      const state = createState({
        p: { id: 'p', children: ['a'] },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          p: { id: 'p', children: ['b'] },
          b: { id: 'b', parent: 'p' },
        },
      })

      expect(result.nodes.p.children).toEqual(['a', 'b'])
      expect(result.nodes.p.children?.filter(c => c === 'b')).toHaveLength(1)
    })

    it('distributes children to different parents in same batch', () => {
      const state = createState({
        p1: { id: 'p1', children: [] },
        p2: { id: 'p2', children: ['existing'] },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          c1: { id: 'c1', parent: 'p1' },
          c2: { id: 'c2', parent: 'p2' },
          c3: { id: 'c3', parent: 'p1' },
        },
      })

      expect(result.nodes.p1.children).toEqual(expect.arrayContaining(['c1', 'c3']))
      expect(result.nodes.p1.children).toHaveLength(2)
      expect(result.nodes.p2.children).toEqual(['existing', 'c2'])
    })
  })

  describe('edge merging', () => {
    it('merges new edges into state', () => {
      const state = createState({ n1: { id: 'n1' } })

      const result = mergeWorkflowChanges(state, {
        edgesChanged: { e1: { id: 'e1', start: 'n1', end: 'n2' } },
      })

      expect(result.edges).toEqual({ e1: { id: 'e1', start: 'n1', end: 'n2' } })
    })

    it('preserves existing edges when adding new ones', () => {
      const state: WorkflowContentData = {
        ...createState({ n1: { id: 'n1' } }),
        edges: { e1: { id: 'e1', start: 'a', end: 'b' } },
      }

      const result = mergeWorkflowChanges(state, {
        edgesChanged: { e2: { id: 'e2', start: 'c', end: 'd' } },
      })

      expect(result.edges).toEqual({
        e1: { id: 'e1', start: 'a', end: 'b' },
        e2: { id: 'e2', start: 'c', end: 'd' },
      })
    })

    it('overwrites existing edge with same id', () => {
      const state: WorkflowContentData = {
        ...createState({ n1: { id: 'n1' } }),
        edges: { e1: { id: 'e1', start: 'a', end: 'b', color: '#000' } },
      }

      const result = mergeWorkflowChanges(state, {
        edgesChanged: { e1: { id: 'e1', start: 'a', end: 'b', color: '#fff' } },
      })

      expect(result.edges?.e1.color).toBe('#fff')
    })

    it('returns current edges unchanged when edgesChanged is undefined', () => {
      const state: WorkflowContentData = {
        ...createState({ n1: { id: 'n1' } }),
        edges: { e1: { id: 'e1', start: 'a', end: 'b' } },
      }

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', title: 'Updated' } },
      })

      expect(result.edges).toBe(state.edges)
    })

    it('merges edges into undefined current.edges', () => {
      const state = createState({ n1: { id: 'n1' } })
      delete (state as Record<string, unknown>).edges

      const result = mergeWorkflowChanges(state, {
        edgesChanged: { e1: { id: 'e1', start: 'a', end: 'b' } },
      })

      expect(result.edges).toEqual({ e1: { id: 'e1', start: 'a', end: 'b' } })
    })

    it('handles simultaneous node and edge changes', () => {
      const state: WorkflowContentData = {
        ...createState({ n1: { id: 'n1', title: 'Old' } }),
        edges: { e1: { id: 'e1', start: 'n1', end: 'n2' } },
      }

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', title: 'New' } },
        edgesChanged: { e2: { id: 'e2', start: 'n1', end: 'n3' } },
      })

      expect(result.nodes.n1.title).toBe('New')
      expect(result.edges).toEqual({
        e1: { id: 'e1', start: 'n1', end: 'n2' },
        e2: { id: 'e2', start: 'n1', end: 'n3' },
      })
    })
  })

  describe('immutability', () => {
    it('does not mutate current.nodes', () => {
      const original = { n1: { id: 'n1', title: 'Original' } }
      const state = createState(original)
      const snapshot = { ...original }

      mergeWorkflowChanges(state, {
        nodesChanged: { n1: { id: 'n1', title: 'Changed' } },
      })

      expect(state.nodes).toEqual(snapshot)
    })

    it('does not mutate nodesChanged input', () => {
      const state = createState({ n1: { id: 'n1' } })
      const changes = { nodesChanged: { n2: { id: 'n2', title: 'New' } } }
      const snapshot = { ...changes.nodesChanged }

      mergeWorkflowChanges(state, changes)

      expect(changes.nodesChanged).toEqual(snapshot)
    })

    it('does not mutate edgesChanged input', () => {
      const state: WorkflowContentData = {
        ...createState({ n1: { id: 'n1' } }),
        edges: { e1: { id: 'e1', start: 'a', end: 'b' } },
      }
      const edgesChanged = { e2: { id: 'e2', start: 'c', end: 'd' } as EdgeData }
      const snapshot = { ...edgesChanged }

      mergeWorkflowChanges(state, { edgesChanged })

      expect(edgesChanged).toEqual(snapshot)
    })

    it('returns new nodes reference', () => {
      const state = createState({ n1: { id: 'n1' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n2: { id: 'n2' } },
      })

      expect(result).not.toBe(state)
      expect(result.nodes).not.toBe(state.nodes)
    })

    it('does not mutate parent node during reconciliation', () => {
      const parent: NodeData = { id: 'p', children: ['existing'] }
      const state = createState({ p: parent })

      mergeWorkflowChanges(state, {
        nodesChanged: { c: { id: 'c', parent: 'p' } },
      })

      expect(parent.children).toEqual(['existing'])
    })

    it('does not mutate current.edges', () => {
      const originalEdges = { e1: { id: 'e1', start: 'a', end: 'b' } as EdgeData }
      const state: WorkflowContentData = {
        ...createState({ n1: { id: 'n1' } }),
        edges: originalEdges,
      }
      const snapshot = { ...originalEdges }

      mergeWorkflowChanges(state, {
        edgesChanged: { e2: { id: 'e2', start: 'c', end: 'd' } },
      })

      expect(state.edges).toEqual(snapshot)
    })
  })

  describe('prompts field merge semantics', () => {
    it('keeps existing prompts when incoming node omits the prompts field', () => {
      const state = createState({ p: { id: 'p', prompts: ['a', 'b'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { p: { id: 'p', title: 'Updated' } },
      })

      expect(result.nodes.p.prompts).toEqual(['a', 'b'])
    })

    it('replaces existing prompts with incoming prompts array', () => {
      const state = createState({ p: { id: 'p', prompts: ['old'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { p: { id: 'p', prompts: ['new1', 'new2'] } },
      })

      expect(result.nodes.p.prompts).toEqual(['new1', 'new2'])
    })

    it('sets prompts when existing node has no prompts field', () => {
      const state = createState({ p: { id: 'p' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { p: { id: 'p', prompts: ['new1'] } },
      })

      expect(result.nodes.p.prompts).toEqual(['new1'])
    })

    it('accepts empty prompts array from incoming, clearing all prompts', () => {
      const state = createState({ p: { id: 'p', prompts: ['old'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { p: { id: 'p', prompts: [] } },
      })

      expect(result.nodes.p.prompts).toEqual([])
    })

    it('leaves prompts undefined when neither existing nor incoming has prompts', () => {
      const state = createState({ p: { id: 'p' } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { p: { id: 'p', title: 'Updated' } },
      })

      expect(result.nodes.p.prompts).toBeUndefined()
    })

    it('preserves both children and prompts when incoming omits both fields', () => {
      const state = createState({ n: { id: 'n', children: ['c1'], prompts: ['p1'] } })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n: { id: 'n', title: 'Updated' } },
      })

      expect(result.nodes.n.children).toEqual(['c1'])
      expect(result.nodes.n.prompts).toEqual(['p1'])
    })
  })

  describe('prompt eviction', () => {
    it('removes evicted prompt id from the parent children array', () => {
      const state = createState({
        n: { id: 'n', children: ['c1', 'p1'], prompts: ['p1'] },
        c1: { id: 'c1', parent: 'n' },
        p1: { id: 'p1', parent: 'n' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          n: { id: 'n', children: ['c1', 'p2'], prompts: ['p2'] },
          p2: { id: 'p2', parent: 'n' },
        },
      })

      expect(result.nodes.n.children).not.toContain('p1')
      expect(result.nodes.n.children).toContain('p2')
    })

    it('removes evicted prompt node from the store', () => {
      const state = createState({
        n: { id: 'n', children: ['p1'], prompts: ['p1'] },
        p1: { id: 'p1', parent: 'n' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n: { id: 'n', children: [], prompts: [] } },
      })

      expect(result.nodes.p1).toBeUndefined()
    })

    it('does not evict non-prompt children', () => {
      const state = createState({
        n: { id: 'n', children: ['c1', 'p1'], prompts: ['p1'] },
        c1: { id: 'c1', parent: 'n' },
        p1: { id: 'p1', parent: 'n' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          n: { id: 'n', children: ['c1', 'p2'], prompts: ['p2'] },
          p2: { id: 'p2', parent: 'n' },
        },
      })

      expect(result.nodes.c1).toBeDefined()
    })

    it('recursively removes all descendants of an evicted prompt node', () => {
      const state = createState({
        n: { id: 'n', children: ['p1'], prompts: ['p1'] },
        p1: { id: 'p1', parent: 'n', children: ['p1a'] },
        p1a: { id: 'p1a', parent: 'p1', children: ['p1a1'] },
        p1a1: { id: 'p1a1', parent: 'p1a' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n: { id: 'n', children: [], prompts: [] } },
      })

      expect(result.nodes.p1).toBeUndefined()
      expect(result.nodes.p1a).toBeUndefined()
      expect(result.nodes.p1a1).toBeUndefined()
    })

    it('evicts all prompts when incoming replaces with a fully disjoint set', () => {
      const state = createState({
        n: { id: 'n', children: ['p1', 'p2'], prompts: ['p1', 'p2'] },
        p1: { id: 'p1', parent: 'n' },
        p2: { id: 'p2', parent: 'n' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          n: { id: 'n', children: ['p3', 'p4'], prompts: ['p3', 'p4'] },
          p3: { id: 'p3', parent: 'n' },
          p4: { id: 'p4', parent: 'n' },
        },
      })

      expect(result.nodes.p1).toBeUndefined()
      expect(result.nodes.p2).toBeUndefined()
      expect(result.nodes.p3).toBeDefined()
      expect(result.nodes.p4).toBeDefined()
    })

    it('retains a prompt id that appears in both existing and incoming prompts', () => {
      const state = createState({
        n: { id: 'n', children: ['p1', 'p2'], prompts: ['p1', 'p2'] },
        p1: { id: 'p1', parent: 'n' },
        p2: { id: 'p2', parent: 'n' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n: { id: 'n', children: ['p1'], prompts: ['p1'] } },
      })

      expect(result.nodes.p1).toBeDefined()
      expect(result.nodes.n.children).toContain('p1')
      expect(result.nodes.p2).toBeUndefined()
      expect(result.nodes.n.children).not.toContain('p2')
    })

    it('does not evict anything when incoming omits the prompts field', () => {
      const state = createState({
        n: { id: 'n', children: ['c1', 'p1'], prompts: ['p1'] },
        c1: { id: 'c1', parent: 'n' },
        p1: { id: 'p1', parent: 'n' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: { n: { id: 'n', title: 'Updated' } },
      })

      expect(result.nodes.p1).toBeDefined()
      expect(result.nodes.n.children).toContain('p1')
    })

    it('evicts prompt nodes independently across multiple parents in one batch', () => {
      const state = createState({
        a: { id: 'a', children: ['ap1'], prompts: ['ap1'] },
        ap1: { id: 'ap1', parent: 'a' },
        b: { id: 'b', children: ['bp1'], prompts: ['bp1'] },
        bp1: { id: 'bp1', parent: 'b' },
      })

      const result = mergeWorkflowChanges(state, {
        nodesChanged: {
          a: { id: 'a', children: ['ap2'], prompts: ['ap2'] },
          ap2: { id: 'ap2', parent: 'a' },
          b: { id: 'b', children: ['bp2'], prompts: ['bp2'] },
          bp2: { id: 'bp2', parent: 'b' },
        },
      })

      expect(result.nodes.ap1).toBeUndefined()
      expect(result.nodes.bp1).toBeUndefined()
      expect(result.nodes.ap2).toBeDefined()
      expect(result.nodes.bp2).toBeDefined()
    })
  })
})
