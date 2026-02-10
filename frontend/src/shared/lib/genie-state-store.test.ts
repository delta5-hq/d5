import { describe, it, expect, beforeEach } from 'vitest'
import { genieStateStore } from './genie-state-store'

describe('GenieStateStore', () => {
  beforeEach(() => {
    genieStateStore.clearAll()
  })

  describe('subscription and notification', () => {
    it('notifies only subscribed node on setState', () => {
      let node1Updates = 0
      let node2Updates = 0

      const unsub1 = genieStateStore.subscribe('node1', () => node1Updates++)
      const unsub2 = genieStateStore.subscribe('node2', () => node2Updates++)

      genieStateStore.setState('node1', 'busy')

      expect(node1Updates).toBe(1)
      expect(node2Updates).toBe(0)

      unsub1()
      unsub2()
    })

    it('does not notify if state unchanged', () => {
      let updates = 0
      const unsub = genieStateStore.subscribe('node1', () => updates++)

      genieStateStore.setState('node1', 'idle')
      genieStateStore.setState('node1', 'idle')
      genieStateStore.setState('node1', 'idle')

      expect(updates).toBe(0)

      unsub()
    })

    it('notifies on state change', () => {
      let updates = 0
      const unsub = genieStateStore.subscribe('node1', () => updates++)

      genieStateStore.setState('node1', 'busy')
      expect(updates).toBe(1)

      genieStateStore.setState('node1', 'done-success')
      expect(updates).toBe(2)

      unsub()
    })

    it('cleans up listener on unsubscribe', () => {
      let updates = 0
      const unsub = genieStateStore.subscribe('node1', () => updates++)

      genieStateStore.setState('node1', 'busy')
      expect(updates).toBe(1)

      unsub()

      genieStateStore.setState('node1', 'idle')
      expect(updates).toBe(1)
    })

    it('removes empty listener set after last unsubscribe', () => {
      const unsub1 = genieStateStore.subscribe('node1', () => {})
      const unsub2 = genieStateStore.subscribe('node1', () => {})

      expect(genieStateStore.getListenerCount('node1')).toBe(2)

      unsub1()
      expect(genieStateStore.getListenerCount('node1')).toBe(1)

      unsub2()
      expect(genieStateStore.getListenerCount('node1')).toBe(0)
    })
  })

  describe('state management', () => {
    it('returns idle for unknown nodeId', () => {
      expect(genieStateStore.getSnapshot('unknown')).toBe('idle')
      expect(genieStateStore.getServerSnapshot('unknown')).toBe('idle')
    })

    it('returns set state for known nodeId', () => {
      genieStateStore.setState('node1', 'busy')
      expect(genieStateStore.getSnapshot('node1')).toBe('busy')
    })

    it('updates state correctly', () => {
      genieStateStore.setState('node1', 'idle')
      expect(genieStateStore.getSnapshot('node1')).toBe('idle')

      genieStateStore.setState('node1', 'busy')
      expect(genieStateStore.getSnapshot('node1')).toBe('busy')

      genieStateStore.setState('node1', 'done-success')
      expect(genieStateStore.getSnapshot('node1')).toBe('done-success')
    })
  })

  describe('batch operations', () => {
    it('notifies all changed nodes in batch', () => {
      let node1Updates = 0
      let node2Updates = 0
      let node3Updates = 0

      const unsub1 = genieStateStore.subscribe('node1', () => node1Updates++)
      const unsub2 = genieStateStore.subscribe('node2', () => node2Updates++)
      const unsub3 = genieStateStore.subscribe('node3', () => node3Updates++)

      genieStateStore.batchSetState([
        { nodeId: 'node1', state: 'busy' },
        { nodeId: 'node2', state: 'done-success' },
      ])

      expect(node1Updates).toBe(1)
      expect(node2Updates).toBe(1)
      expect(node3Updates).toBe(0)

      unsub1()
      unsub2()
      unsub3()
    })

    it('skips unchanged nodes in batch', () => {
      genieStateStore.setState('node1', 'idle')

      let node1Updates = 0
      const unsub = genieStateStore.subscribe('node1', () => node1Updates++)

      genieStateStore.batchSetState([
        { nodeId: 'node1', state: 'idle' },
        { nodeId: 'node2', state: 'busy' },
      ])

      expect(node1Updates).toBe(0)

      unsub()
    })
  })

  describe('hydration', () => {
    it('populates store without notifications', () => {
      let updates = 0
      const unsub = genieStateStore.subscribe('node1', () => updates++)

      genieStateStore.hydrate({
        node1: 'busy',
        node2: 'idle',
        node3: 'done-success',
      })

      expect(updates).toBe(0)
      expect(genieStateStore.getSnapshot('node1')).toBe('busy')
      expect(genieStateStore.getSnapshot('node2')).toBe('idle')
      expect(genieStateStore.getSnapshot('node3')).toBe('done-success')

      unsub()
    })
  })

  describe('cleanup', () => {
    it('deletes single node state and listeners', () => {
      genieStateStore.setState('node1', 'busy')
      const unsub = genieStateStore.subscribe('node1', () => {})

      expect(genieStateStore.getSnapshot('node1')).toBe('busy')
      expect(genieStateStore.getListenerCount('node1')).toBe(1)

      genieStateStore.deleteNode('node1')

      expect(genieStateStore.getSnapshot('node1')).toBe('idle')
      expect(genieStateStore.getListenerCount('node1')).toBe(0)

      unsub()
    })

    it('clears all state and listeners', () => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node2', 'idle')

      const unsub1 = genieStateStore.subscribe('node1', () => {})
      const unsub2 = genieStateStore.subscribe('node2', () => {})

      genieStateStore.clearAll()

      expect(genieStateStore.getSnapshot('node1')).toBe('idle')
      expect(genieStateStore.getSnapshot('node2')).toBe('idle')
      expect(genieStateStore.getListenerCount('node1')).toBe(0)
      expect(genieStateStore.getListenerCount('node2')).toBe(0)

      unsub1()
      unsub2()
    })

    it('reconcile removes nodes not in valid set', () => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node2', 'done-success')
      genieStateStore.setState('node3', 'busy-alert')

      genieStateStore.reconcile(new Set(['node1', 'node3']))

      expect(genieStateStore.getSnapshot('node1')).toBe('busy')
      expect(genieStateStore.getSnapshot('node2')).toBe('idle')
      expect(genieStateStore.getSnapshot('node3')).toBe('busy-alert')
    })

    it('reconcile clears listeners for removed nodes', () => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node2', 'done-success')

      const unsub1 = genieStateStore.subscribe('node1', () => {})
      const unsub2 = genieStateStore.subscribe('node2', () => {})

      expect(genieStateStore.getListenerCount('node1')).toBe(1)
      expect(genieStateStore.getListenerCount('node2')).toBe(1)

      genieStateStore.reconcile(new Set(['node1']))

      expect(genieStateStore.getListenerCount('node1')).toBe(1)
      expect(genieStateStore.getListenerCount('node2')).toBe(0)

      unsub1()
      unsub2()
    })

    it('reconcile preserves all when all nodes valid', () => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node2', 'done-success')

      genieStateStore.reconcile(new Set(['node1', 'node2', 'node3']))

      expect(genieStateStore.getSnapshot('node1')).toBe('busy')
      expect(genieStateStore.getSnapshot('node2')).toBe('done-success')
      expect(genieStateStore.getAllStates().size).toBe(2)
    })

    it('reconcile is idempotent', () => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node2', 'done-success')

      const validSet = new Set(['node1'])

      genieStateStore.reconcile(validSet)
      genieStateStore.reconcile(validSet)
      genieStateStore.reconcile(validSet)

      expect(genieStateStore.getSnapshot('node1')).toBe('busy')
      expect(genieStateStore.getSnapshot('node2')).toBe('idle')
      expect(genieStateStore.getAllStates().size).toBe(1)
    })

    it('reconcile handles empty valid set', () => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node2', 'done-success')

      genieStateStore.reconcile(new Set())

      expect(genieStateStore.getSnapshot('node1')).toBe('idle')
      expect(genieStateStore.getSnapshot('node2')).toBe('idle')
    })

    it('reconcile handles empty store', () => {
      expect(() => {
        genieStateStore.reconcile(new Set(['node1', 'node2']))
      }).not.toThrow()
    })
  })

  describe('global listeners', () => {
    it('notifies global listeners on any change', () => {
      let globalUpdates = 0
      const unsub = genieStateStore.subscribeToAll(() => globalUpdates++)

      genieStateStore.setState('node1', 'busy')
      expect(globalUpdates).toBe(1)

      genieStateStore.setState('node2', 'done-success')
      expect(globalUpdates).toBe(2)

      genieStateStore.batchSetState([
        { nodeId: 'node3', state: 'done-success' },
        { nodeId: 'node4', state: 'busy' },
      ])
      expect(globalUpdates).toBe(3)

      unsub()
    })

    it('does not notify global listeners on no-op', () => {
      genieStateStore.setState('node1', 'idle')

      let globalUpdates = 0
      const unsub = genieStateStore.subscribeToAll(() => globalUpdates++)

      genieStateStore.setState('node1', 'idle')
      expect(globalUpdates).toBe(0)

      unsub()
    })
  })

  describe('getAllStates', () => {
    it('returns copy of all states', () => {
      genieStateStore.setState('node1', 'busy')
      genieStateStore.setState('node2', 'done-success')

      const states = genieStateStore.getAllStates()

      expect(states.size).toBe(2)
      expect(states.get('node1')).toBe('busy')
      expect(states.get('node2')).toBe('done-success')

      states.set('node3', 'idle')
      expect(genieStateStore.getSnapshot('node3')).toBe('idle')
    })
  })
})
