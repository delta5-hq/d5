import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from '@shared/lib/store'
import type { WorkflowStoreState } from '../workflow-store-types'
import { INITIAL_WORKFLOW_STATE } from '../workflow-store-types'
import { bindExpansionActions } from '../workflow-store-expansion'
import type { DebouncedPersister } from '../workflow-store-persistence'

function makeStore(overrides: Partial<WorkflowStoreState> = {}) {
  return createStore<WorkflowStoreState>({
    ...INITIAL_WORKFLOW_STATE,
    workflowId: 'wf-test',
    ...overrides,
  })
}

function makePersister(): DebouncedPersister {
  return { schedule: vi.fn(), flush: vi.fn(), cancel: vi.fn(), destroy: vi.fn() }
}

describe('bindExpansionActions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('toggleExpanded', () => {
    it('expands collapsed node', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: ['c1'], collapsed: true } },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { toggleExpanded } = bindExpansionActions(store, persister)

      toggleExpanded('n1')

      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(true)
      expect(state.nodes.n1.collapsed).toBe(false)
      expect(state.isDirty).toBe(true)
      expect(persister.schedule).toHaveBeenCalledOnce()
    })

    it('collapses expanded node', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: ['c1'], collapsed: false } },
        expandedIds: new Set(['n1']),
      })
      const persister = makePersister()
      const { toggleExpanded } = bindExpansionActions(store, persister)

      toggleExpanded('n1')

      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(false)
      expect(state.nodes.n1.collapsed).toBe(true)
      expect(state.isDirty).toBe(true)
      expect(persister.schedule).toHaveBeenCalledOnce()
    })

    it('preserves other node properties when toggling', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', title: 'Test', command: '/test', children: [], collapsed: true } },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { toggleExpanded } = bindExpansionActions(store, persister)

      toggleExpanded('n1')

      const node = store.getState().nodes.n1
      expect(node.title).toBe('Test')
      expect(node.command).toBe('/test')
      expect(node.collapsed).toBe(false)
    })

    it('handles rapid toggle without state corruption', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], collapsed: true } },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { toggleExpanded } = bindExpansionActions(store, persister)

      toggleExpanded('n1')
      toggleExpanded('n1')
      toggleExpanded('n1')

      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(true)
      expect(state.nodes.n1.collapsed).toBe(false)
    })
  })

  describe('expandNode', () => {
    it('expands collapsed node', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], collapsed: true } },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { expandNode } = bindExpansionActions(store, persister)

      expandNode('n1')

      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(true)
      expect(state.nodes.n1.collapsed).toBe(false)
      expect(state.isDirty).toBe(true)
      expect(persister.schedule).toHaveBeenCalledOnce()
    })

    it('is idempotent when node already expanded', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], collapsed: false } },
        expandedIds: new Set(['n1']),
      })
      const persister = makePersister()
      const { expandNode } = bindExpansionActions(store, persister)

      expandNode('n1')

      expect(store.getState().expandedIds.has('n1')).toBe(true)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('expands multiple nodes independently', () => {
      const store = makeStore({
        nodes: {
          n1: { id: 'n1', children: [], collapsed: true },
          n2: { id: 'n2', children: [], collapsed: true },
        },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { expandNode } = bindExpansionActions(store, persister)

      expandNode('n1')
      expandNode('n2')

      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(true)
      expect(state.expandedIds.has('n2')).toBe(true)
      expect(state.nodes.n1.collapsed).toBe(false)
      expect(state.nodes.n2.collapsed).toBe(false)
    })
  })

  describe('collapseNode', () => {
    it('collapses expanded node', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], collapsed: false } },
        expandedIds: new Set(['n1']),
      })
      const persister = makePersister()
      const { collapseNode } = bindExpansionActions(store, persister)

      collapseNode('n1')

      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(false)
      expect(state.nodes.n1.collapsed).toBe(true)
      expect(state.isDirty).toBe(true)
      expect(persister.schedule).toHaveBeenCalledOnce()
    })

    it('is idempotent when node already collapsed', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], collapsed: true } },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { collapseNode } = bindExpansionActions(store, persister)

      collapseNode('n1')

      expect(store.getState().expandedIds.has('n1')).toBe(false)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('collapses multiple nodes independently', () => {
      const store = makeStore({
        nodes: {
          n1: { id: 'n1', children: [], collapsed: false },
          n2: { id: 'n2', children: [], collapsed: false },
        },
        expandedIds: new Set(['n1', 'n2']),
      })
      const persister = makePersister()
      const { collapseNode } = bindExpansionActions(store, persister)

      collapseNode('n1')
      collapseNode('n2')

      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(false)
      expect(state.expandedIds.has('n2')).toBe(false)
      expect(state.nodes.n1.collapsed).toBe(true)
      expect(state.nodes.n2.collapsed).toBe(true)
    })
  })

  describe('null safety and guards', () => {
    it('ignores toggle on nonexistent node', () => {
      const store = makeStore({ nodes: {}, expandedIds: new Set() })
      const persister = makePersister()
      const { toggleExpanded } = bindExpansionActions(store, persister)

      toggleExpanded('missing')

      expect(store.getState().expandedIds.size).toBe(0)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('ignores expand on nonexistent node', () => {
      const store = makeStore({ nodes: {}, expandedIds: new Set() })
      const persister = makePersister()
      const { expandNode } = bindExpansionActions(store, persister)

      expandNode('missing')

      expect(store.getState().expandedIds.size).toBe(0)
      expect(persister.schedule).not.toHaveBeenCalled()
    })

    it('ignores collapse on nonexistent node', () => {
      const store = makeStore({ nodes: {}, expandedIds: new Set() })
      const persister = makePersister()
      const { collapseNode } = bindExpansionActions(store, persister)

      collapseNode('missing')

      expect(store.getState().expandedIds.size).toBe(0)
      expect(persister.schedule).not.toHaveBeenCalled()
    })
  })

  describe('state consistency', () => {
    it('maintains consistency between expandedIds and node.collapsed', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], collapsed: true } },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { expandNode, collapseNode } = bindExpansionActions(store, persister)

      expandNode('n1')
      let state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(true)
      expect(state.nodes.n1.collapsed).toBe(false)

      collapseNode('n1')
      state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(false)
      expect(state.nodes.n1.collapsed).toBe(true)
    })

    it('preserves unrelated nodes during expansion operations', () => {
      const store = makeStore({
        nodes: {
          n1: { id: 'n1', title: 'Node 1', children: [], collapsed: true },
          n2: { id: 'n2', title: 'Node 2', children: [], collapsed: false },
        },
        expandedIds: new Set(['n2']),
      })
      const persister = makePersister()
      const { expandNode } = bindExpansionActions(store, persister)

      expandNode('n1')

      const state = store.getState()
      expect(state.nodes.n2.title).toBe('Node 2')
      expect(state.nodes.n2.collapsed).toBe(false)
      expect(state.expandedIds.has('n2')).toBe(true)
    })

    it('updates both expandedIds and node.collapsed atomically', () => {
      const store = makeStore({
        nodes: { n1: { id: 'n1', children: [], collapsed: true } },
        expandedIds: new Set(),
      })
      const persister = makePersister()
      const { toggleExpanded } = bindExpansionActions(store, persister)

      const notificationCount = vi.fn()
      store.subscribe(notificationCount)

      toggleExpanded('n1')

      expect(notificationCount).toHaveBeenCalledOnce()
      const state = store.getState()
      expect(state.expandedIds.has('n1')).toBe(true)
      expect(state.nodes.n1.collapsed).toBe(false)
    })
  })
})
