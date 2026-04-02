import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { GenieStateStore } from '../genie-state-store'
import type { ProgressStreamClient } from '../progress-stream-client'

type ProgressCallback = ConstructorParameters<typeof ProgressStreamClient>[1]

let capturedProgressCallback: ProgressCallback | null = null

vi.mock('../progress-stream-client', () => {
  function ProgressStreamClient(_baseUrl: string, onProgress: ProgressCallback) {
    capturedProgressCallback = onProgress
    return { connect: vi.fn(), disconnect: vi.fn() }
  }
  return { ProgressStreamClient }
})

describe('GenieStateStore', () => {
  let store: GenieStateStore

  beforeEach(() => {
    store = new GenieStateStore()
    capturedProgressCallback = null
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function connectAndGetCallback(): ProgressCallback {
    store.connectToProgressStream('http://localhost')
    return capturedProgressCallback!
  }

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
      store.batchSetState([
        { nodeId: 'node-1', state: 'busy' },
        { nodeId: 'node-2', state: 'done-success' },
        { nodeId: 'node-3', state: 'idle' },
      ])

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

    it('does not notify global listeners when all states in batch are unchanged', () => {
      store.setState('node-1', 'busy')
      const globalListener = vi.fn()
      store.subscribeToAll(globalListener)

      store.batchSetState([{ nodeId: 'node-1', state: 'busy' }])

      expect(globalListener).not.toHaveBeenCalled()
    })

    it('does not notify when batch is empty', () => {
      const globalListener = vi.fn()
      store.subscribeToAll(globalListener)

      store.batchSetState([])

      expect(globalListener).not.toHaveBeenCalled()
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
      const unsubscribe = store.subscribe('node-1', vi.fn())

      expect(store.getListenerCount('node-1')).toBe(1)
      unsubscribe()

      expect(store.getListenerCount('node-1')).toBe(0)
    })

    it('tracks multiple listeners per node', () => {
      store.subscribe('node-1', vi.fn())
      store.subscribe('node-1', vi.fn())

      expect(store.getListenerCount('node-1')).toBe(2)
    })

    it('calling unsubscribe twice is idempotent', () => {
      const listener = vi.fn()
      const unsubscribe = store.subscribe('node-1', listener)

      unsubscribe()
      expect(() => unsubscribe()).not.toThrow()

      store.setState('node-1', 'busy')
      expect(listener).not.toHaveBeenCalled()
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

    it('overwrites existing error', () => {
      store.setError('node-1', 'First error')
      store.setError('node-1', 'Second error')
      expect(store.getError('node-1')).toBe('Second error')
    })

    it('stores errors independently per node', () => {
      store.setError('node-1', 'Error 1')
      store.setError('node-2', 'Error 2')

      expect(store.getError('node-1')).toBe('Error 1')
      expect(store.getError('node-2')).toBe('Error 2')
    })

    it('clears only the specified node error', () => {
      store.setError('node-1', 'Error 1')
      store.setError('node-2', 'Error 2')
      store.clearError('node-1')

      expect(store.getError('node-1')).toBeUndefined()
      expect(store.getError('node-2')).toBe('Error 2')
    })

    it('stores empty string error without coercing to undefined', () => {
      store.setError('node-1', '')
      expect(store.getError('node-1')).toBe('')
    })

    it('stores error strings containing special characters without corruption', () => {
      const specialError = 'Error:\n\t<script>alert("xss")</script>'
      store.setError('node-1', specialError)
      expect(store.getError('node-1')).toBe(specialError)
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
      store.hydrate({ 'node-1': 'busy', 'node-2': 'done-success', 'node-3': 'idle' })

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

    it('overwrites existing state without notification', () => {
      store.setState('node-1', 'busy')
      const listener = vi.fn()
      store.subscribe('node-1', listener)

      store.hydrate({ 'node-1': 'done-success' })

      expect(store.getSnapshot('node-1')).toBe('done-success')
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
      store.subscribe('node-1', vi.fn())

      store.deleteNode('node-1')

      expect(store.getListenerCount('node-1')).toBe(0)
    })

    it('clears suppression for deleted node so it can receive SSE events after re-creation', () => {
      const onProgress = connectAndGetCallback()
      store.suppressNode('node-1')
      store.deleteNode('node-1')

      onProgress('node-1', 'busy')

      expect(store.getSnapshot('node-1')).toBe('busy')
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

    it('is idempotent when called repeatedly with the same valid set', () => {
      store.setState('node-1', 'busy')
      store.setState('node-2', 'done-success')
      const validSet = new Set(['node-1'])

      store.reconcile(validSet)
      store.reconcile(validSet)
      store.reconcile(validSet)

      expect(store.getSnapshot('node-1')).toBe('busy')
      expect(store.getSnapshot('node-2')).toBe('idle')
      expect(store.getAllStates().size).toBe(1)
    })

    it('does not throw when called on empty store', () => {
      expect(() => store.reconcile(new Set(['node-1', 'node-2']))).not.toThrow()
    })

    it('removes listeners for nodes deleted during reconciliation', () => {
      store.setState('node-1', 'busy')
      store.setState('node-2', 'done-success')
      store.subscribe('node-1', vi.fn())
      store.subscribe('node-2', vi.fn())

      store.reconcile(new Set(['node-1']))

      expect(store.getListenerCount('node-1')).toBe(1)
      expect(store.getListenerCount('node-2')).toBe(0)
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
      store.subscribe('node-1', vi.fn())
      store.subscribe('node-2', vi.fn())

      store.clearAll()

      expect(store.getListenerCount('node-1')).toBe(0)
      expect(store.getListenerCount('node-2')).toBe(0)
    })

    it('clears all suppressions so nodes can receive SSE events after store reset', () => {
      const onProgress = connectAndGetCallback()
      store.suppressNode('node-1')
      store.suppressNode('node-2')
      store.clearAll()

      onProgress('node-1', 'busy')
      onProgress('node-2', 'done-success')

      expect(store.getSnapshot('node-1')).toBe('busy')
      expect(store.getSnapshot('node-2')).toBe('done-success')
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

    it('returns empty map when store has no state', () => {
      expect(store.getAllStates().size).toBe(0)
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

  describe('SSE event handling', () => {
    it('sets state from SSE event', () => {
      const onProgress = connectAndGetCallback()

      onProgress('node-1', 'busy')

      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('sets error when SSE event includes error', () => {
      const onProgress = connectAndGetCallback()

      onProgress('node-1', 'done-failure', 'execution failed')

      expect(store.getError('node-1')).toBe('execution failed')
    })

    it('clears existing error when SSE event has no error', () => {
      const onProgress = connectAndGetCallback()
      store.setError('node-1', 'stale error')

      onProgress('node-1', 'busy')

      expect(store.getError('node-1')).toBeUndefined()
    })
  })

  describe('SSE connection lifecycle', () => {
    it('connects when first called', () => {
      store.connectToProgressStream('http://localhost')
      expect(capturedProgressCallback).not.toBeNull()
    })

    it('second connect call is idempotent and reuses existing connection', () => {
      store.connectToProgressStream('http://localhost')
      const firstCallback = capturedProgressCallback

      store.connectToProgressStream('http://localhost')

      expect(capturedProgressCallback).toBe(firstCallback)
    })

    it('disconnects and allows reconnect', () => {
      store.connectToProgressStream('http://localhost')
      store.disconnectFromProgressStream()

      capturedProgressCallback = null
      store.connectToProgressStream('http://localhost')

      expect(capturedProgressCallback).not.toBeNull()
    })

    it('disconnect when not connected does not throw', () => {
      expect(() => store.disconnectFromProgressStream()).not.toThrow()
    })
  })

  describe('SSE suppression', () => {
    it('suppressed node ignores incoming SSE events', () => {
      const onProgress = connectAndGetCallback()
      store.suppressNode('node-1')

      onProgress('node-1', 'busy')

      expect(store.getSnapshot('node-1')).toBe('idle')
    })

    it('unsuppressed node accepts SSE events again', () => {
      const onProgress = connectAndGetCallback()
      store.suppressNode('node-1')
      store.unsuppressNode('node-1')

      onProgress('node-1', 'busy')

      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('suppression does not block direct setState calls', () => {
      store.suppressNode('node-1')
      store.setState('node-1', 'busy')

      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('suppression is per-node and does not affect other nodes', () => {
      const onProgress = connectAndGetCallback()
      store.suppressNode('node-1')

      onProgress('node-1', 'busy')
      onProgress('node-2', 'busy')

      expect(store.getSnapshot('node-1')).toBe('idle')
      expect(store.getSnapshot('node-2')).toBe('busy')
    })

    it('double suppress is idempotent', () => {
      const onProgress = connectAndGetCallback()
      store.suppressNode('node-1')
      store.suppressNode('node-1')
      store.unsuppressNode('node-1')

      onProgress('node-1', 'busy')

      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('unsuppress on non-suppressed node does not throw', () => {
      expect(() => store.unsuppressNode('node-1')).not.toThrow()
    })

    it('suppressed node also ignores SSE error writes', () => {
      const onProgress = connectAndGetCallback()
      store.suppressNode('node-1')

      onProgress('node-1', 'done-failure', 'some error')

      expect(store.getSnapshot('node-1')).toBe('idle')
      expect(store.getError('node-1')).toBeUndefined()
    })
  })

  describe('SSE auto-reset timer', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('resets done-success to idle 3 seconds after SSE event', () => {
      const onProgress = connectAndGetCallback()
      onProgress('node-1', 'done-success')

      expect(store.getSnapshot('node-1')).toBe('done-success')
      vi.advanceTimersByTime(3000)

      expect(store.getSnapshot('node-1')).toBe('idle')
    })

    it('resets done-failure to idle 3 seconds after SSE event', () => {
      const onProgress = connectAndGetCallback()
      onProgress('node-1', 'done-failure')

      vi.advanceTimersByTime(3000)

      expect(store.getSnapshot('node-1')).toBe('idle')
    })

    it('timer does not reset if state changed before it fires', () => {
      const onProgress = connectAndGetCallback()
      onProgress('node-1', 'done-success')

      vi.advanceTimersByTime(1500)
      store.setState('node-1', 'busy')
      vi.advanceTimersByTime(1500)

      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('does not schedule auto-reset for busy state', () => {
      const onProgress = connectAndGetCallback()
      onProgress('node-1', 'busy')

      vi.advanceTimersByTime(5000)

      expect(store.getSnapshot('node-1')).toBe('busy')
    })

    it('does not schedule auto-reset for idle state', () => {
      const onProgress = connectAndGetCallback()
      onProgress('node-1', 'idle')

      vi.advanceTimersByTime(5000)

      expect(store.getSnapshot('node-1')).toBe('idle')
    })
  })
})
