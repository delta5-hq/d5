import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GenieStateStore, type GenieState } from '../genie-state-store'

vi.mock('../progress-stream-client', () => ({
  ProgressStreamClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

describe('GenieStateStore', () => {
  let store: GenieStateStore

  beforeEach(() => {
    store = new GenieStateStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('state management', () => {
    it('returns idle for uninitialized nodes', () => {
      expect(store.getSnapshot('node-1')).toBe('idle')
      expect(store.getServerSnapshot('node-1')).toBe('idle')
    })

    it('sets and retrieves node state', () => {
      store.setState('node-1', 'busy')
      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('does not notify when state unchanged', () => {
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.setState('node-1', 'busy')
      listener.mockClear()

      store.setState('node-1', 'busy')
      expect(listener).not.toHaveBeenCalled()
    })

    it('notifies node listeners on state change', () => {
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.setState('node-1', 'busy')
      expect(listener).toHaveBeenCalledTimes(1)

      store.setState('node-1', 'done-success')
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('notifies global listeners on state change', () => {
      const listener = vi.fn()
      store.subscribeToAll(listener)

      store.setState('node-1', 'busy')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does not notify other node listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      store.subscribe('node-1', listener1)
      store.subscribe('node-2', listener2)

      store.setState('node-1', 'busy')

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).not.toHaveBeenCalled()
    })
  })

  describe('batch state updates', () => {
    it('updates multiple nodes efficiently', () => {
      const updates: Array<{ nodeId: string; state: GenieState }> = [
        { nodeId: 'node-1', state: 'busy' },
        { nodeId: 'node-2', state: 'done-success' },
        { nodeId: 'node-3', state: 'idle' },
      ]

      store.batchSetState(updates)

      expect(store.getSnapshot('node-1')).toBe('busy')
      expect(store.getSnapshot('node-2')).toBe('done-success')
      expect(store.getSnapshot('node-3')).toBe('idle')
    })

    it('notifies each changed node once', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      store.subscribe('node-1', listener1)
      store.subscribe('node-2', listener2)

      store.batchSetState([
        { nodeId: 'node-1', state: 'busy' },
        { nodeId: 'node-2', state: 'busy' },
      ])

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('notifies global listeners once per batch', () => {
      const globalListener = vi.fn()
      store.subscribeToAll(globalListener)

      store.batchSetState([
        { nodeId: 'node-1', state: 'busy' },
        { nodeId: 'node-2', state: 'busy' },
        { nodeId: 'node-3', state: 'busy' },
      ])

      expect(globalListener).toHaveBeenCalledTimes(1)
    })

    it('skips unchanged states in batch', () => {
      store.setState('node-1', 'busy')
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.batchSetState([
        { nodeId: 'node-1', state: 'busy' },
        { nodeId: 'node-2', state: 'idle' },
      ])

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('subscription lifecycle', () => {
    it('unsubscribes node listener', () => {
      const listener = vi.fn()
      const unsubscribe = store.subscribe('node-1', listener)

      store.setState('node-1', 'busy')
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
      store.setState('node-1', 'done-success')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('unsubscribes global listener', () => {
      const listener = vi.fn()
      const unsubscribe = store.subscribeToAll(listener)

      store.setState('node-1', 'busy')
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
      store.setState('node-2', 'busy')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('cleans up listener set when last listener removed', () => {
      const listener = vi.fn()
      const unsubscribe = store.subscribe('node-1', listener)

      expect(store.getListenerCount('node-1')).toBe(1)

      unsubscribe()
      expect(store.getListenerCount('node-1')).toBe(0)
    })

    it('tracks multiple listeners per node', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      store.subscribe('node-1', listener1)
      store.subscribe('node-1', listener2)

      expect(store.getListenerCount('node-1')).toBe(2)
    })
  })

  describe('error tracking', () => {
    it('stores and retrieves errors', () => {
      store.setError('node-1', 'Test error')
      expect(store.getError('node-1')).toBe('Test error')
    })

    it('returns undefined for nodes without errors', () => {
      expect(store.getError('node-1')).toBeUndefined()
    })

    it('clears errors', () => {
      store.setError('node-1', 'Test error')
      store.clearError('node-1')
      expect(store.getError('node-1')).toBeUndefined()
    })

    it('notifies listeners when error set', () => {
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.setError('node-1', 'Test error')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('notifies listeners when error cleared', () => {
      store.setError('node-1', 'Test error')
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.clearError('node-1')
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('hydration', () => {
    it('initializes state map from external source', () => {
      const initialStates: Record<string, GenieState> = {
        'node-1': 'busy',
        'node-2': 'done-success',
        'node-3': 'idle',
      }

      store.hydrate(initialStates)

      expect(store.getSnapshot('node-1')).toBe('busy')
      expect(store.getSnapshot('node-2')).toBe('done-success')
      expect(store.getSnapshot('node-3')).toBe('idle')
    })

    it('does not trigger notifications during hydration', () => {
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.hydrate({ 'node-1': 'busy' })

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('node deletion', () => {
    it('removes state and error for deleted node', () => {
      store.setState('node-1', 'busy')
      store.setError('node-1', 'Test error')

      store.deleteNode('node-1')

      expect(store.getSnapshot('node-1')).toBe('idle')
      expect(store.getError('node-1')).toBeUndefined()
    })

    it('removes listeners for deleted node', () => {
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.deleteNode('node-1')

      expect(store.getListenerCount('node-1')).toBe(0)
    })
  })

  describe('reconciliation', () => {
    it('deletes orphan nodes not in valid set', () => {
      store.setState('node-1', 'busy')
      store.setState('node-2', 'busy')
      store.setState('node-3', 'busy')
      store.setError('node-2', 'Error')

      store.reconcile(new Set(['node-1', 'node-3']))

      expect(store.getSnapshot('node-1')).toBe('busy')
      expect(store.getSnapshot('node-2')).toBe('idle')
      expect(store.getSnapshot('node-3')).toBe('busy')
      expect(store.getError('node-2')).toBeUndefined()
    })

    it('preserves all nodes when all are valid', () => {
      store.setState('node-1', 'busy')
      store.setState('node-2', 'done-success')

      store.reconcile(new Set(['node-1', 'node-2']))

      expect(store.getSnapshot('node-1')).toBe('busy')
      expect(store.getSnapshot('node-2')).toBe('done-success')
    })

    it('deletes all nodes when valid set empty', () => {
      store.setState('node-1', 'busy')
      store.setState('node-2', 'busy')

      store.reconcile(new Set())

      expect(store.getSnapshot('node-1')).toBe('idle')
      expect(store.getSnapshot('node-2')).toBe('idle')
    })
  })

  describe('clear all', () => {
    it('removes all state and errors', () => {
      store.setState('node-1', 'busy')
      store.setState('node-2', 'done-success')
      store.setError('node-1', 'Error')

      store.clearAll()

      expect(store.getSnapshot('node-1')).toBe('idle')
      expect(store.getSnapshot('node-2')).toBe('idle')
      expect(store.getError('node-1')).toBeUndefined()
      expect(store.getAllStates().size).toBe(0)
    })

    it('removes all listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      store.subscribe('node-1', listener1)
      store.subscribe('node-2', listener2)

      store.clearAll()

      expect(store.getListenerCount('node-1')).toBe(0)
      expect(store.getListenerCount('node-2')).toBe(0)
    })
  })

  describe('state inspection', () => {
    it('returns all states as map', () => {
      store.setState('node-1', 'busy')
      store.setState('node-2', 'done-success')

      const allStates = store.getAllStates()

      expect(allStates.get('node-1')).toBe('busy')
      expect(allStates.get('node-2')).toBe('done-success')
      expect(allStates.size).toBe(2)
    })

    it('returns independent map copy', () => {
      store.setState('node-1', 'busy')
      const states1 = store.getAllStates()
      const states2 = store.getAllStates()

      expect(states1).not.toBe(states2)
      states1.set('node-2', 'idle')
      expect(states2.has('node-2')).toBe(false)
    })
  })

  describe('state transition behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('allows any valid state transition', () => {
      const states: GenieState[] = ['idle', 'busy', 'busy-alert', 'done-success', 'done-failure']

      for (const state of states) {
        store.setState('node-1', state)
        expect(store.getSnapshot('node-1')).toBe(state)
      }
    })

    it('supports rapid state changes', () => {
      store.setState('node-1', 'idle')
      store.setState('node-1', 'busy')
      store.setState('node-1', 'busy-alert')
      store.setState('node-1', 'done-success')
      store.setState('node-1', 'idle')

      expect(store.getSnapshot('node-1')).toBe('idle')
    })

    it('timer guard prevents reset if state changed', () => {
      store.setState('node-1', 'done-success')

      const initialState = store.getSnapshot('node-1')
      expect(initialState).toBe('done-success')

      store.setState('node-1', 'busy')

      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('maintains state until explicit change', () => {
      store.setState('node-1', 'done-failure')

      expect(store.getSnapshot('node-1')).toBe('done-failure')

      vi.advanceTimersByTime(5000)

      expect(store.getSnapshot('node-1')).toBe('done-failure')
    })
  })
})
