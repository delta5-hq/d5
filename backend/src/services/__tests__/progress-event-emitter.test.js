import {progressEventEmitter} from '../../../src/services/progress-event-emitter'
import ProgressEventEmitter from '../progress-event-emitter'

describe('ProgressEventEmitter', () => {
  describe('basic event emission', () => {
    it('should emit progress events with all required fields', done => {
      const nodeId = 'test-node-123'
      const state = 'running'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe(state)
        expect(data.timestamp).toBeDefined()
        expect(typeof data.timestamp).toBe('number')
        expect(data.timestamp).toBeGreaterThan(0)
        done()
      })

      progressEventEmitter.emitProgress(nodeId, state)
    })

    it('should emit start event with preparing state', done => {
      const nodeId = 'test-node-456'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe('preparing')
        expect(data.timestamp).toBeDefined()
        done()
      })

      progressEventEmitter.emitStart(nodeId, {queryType: 'prompt'})
    })

    it('should emit running event with running state', done => {
      const nodeId = 'test-node-running'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe('running')
        done()
      })

      progressEventEmitter.emitRunning(nodeId)
    })

    it('should emit complete event with idle state', done => {
      const nodeId = 'test-node-789'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe('idle')
        expect(data.timestamp).toBeDefined()
        done()
      })

      progressEventEmitter.emitComplete(nodeId)
    })

    it('should emit error event with idle state and error metadata', done => {
      const nodeId = 'test-node-error'
      const error = new Error('Test error')

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe('idle')
        expect(data.error).toBe('Test error')
        expect(data.timestamp).toBeDefined()
        done()
      })

      progressEventEmitter.emitError(nodeId, error)
    })
  })

  describe('metadata handling', () => {
    it('should merge additional metadata into progress event', done => {
      const nodeId = 'test-node-meta'
      const state = 'running'
      const metadata = {queryType: 'prompt', contextId: 'ctx-123', userId: 'user-456'}

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe(state)
        expect(data.queryType).toBe('prompt')
        expect(data.contextId).toBe('ctx-123')
        expect(data.userId).toBe('user-456')
        expect(data.timestamp).toBeDefined()
        done()
      })

      progressEventEmitter.emitProgress(nodeId, state, metadata)
    })

    it('should handle empty metadata object', done => {
      const nodeId = 'test-node-empty-meta'
      const state = 'preparing'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe(state)
        expect(data.timestamp).toBeDefined()
        expect(Object.keys(data)).toEqual(['nodeId', 'state', 'timestamp'])
        done()
      })

      progressEventEmitter.emitProgress(nodeId, state, {})
    })

    it('should preserve metadata in start event', done => {
      const nodeId = 'test-node-start-meta'
      const metadata = {queryType: 'completion', model: 'gpt-4'}

      progressEventEmitter.once('progress', data => {
        expect(data.queryType).toBe('completion')
        expect(data.model).toBe('gpt-4')
        done()
      })

      progressEventEmitter.emitStart(nodeId, metadata)
    })

    it('should preserve metadata in running event', done => {
      const nodeId = 'test-node-running-meta'
      const metadata = {step: 3, totalSteps: 10}

      progressEventEmitter.once('progress', data => {
        expect(data.step).toBe(3)
        expect(data.totalSteps).toBe(10)
        done()
      })

      progressEventEmitter.emitRunning(nodeId, metadata)
    })

    it('should preserve metadata in complete event', done => {
      const nodeId = 'test-node-complete-meta'
      const metadata = {duration: 1500, tokensUsed: 250}

      progressEventEmitter.once('progress', data => {
        expect(data.duration).toBe(1500)
        expect(data.tokensUsed).toBe(250)
        done()
      })

      progressEventEmitter.emitComplete(nodeId, metadata)
    })

    it('should merge error message with metadata in error event', done => {
      const nodeId = 'test-node-error-meta'
      const error = new Error('Network timeout')
      const metadata = {retryCount: 3, lastAttemptAt: Date.now()}

      progressEventEmitter.once('progress', data => {
        expect(data.error).toBe('Network timeout')
        expect(data.retryCount).toBe(3)
        expect(data.lastAttemptAt).toBeDefined()
        done()
      })

      progressEventEmitter.emitError(nodeId, error, metadata)
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in nodeId', done => {
      const nodeId = 'node-with-special-chars-!@#$%^&*()'
      const state = 'running'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        done()
      })

      progressEventEmitter.emitProgress(nodeId, state)
    })

    it('should handle very long nodeId', done => {
      const nodeId = 'a'.repeat(1000)
      const state = 'running'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.nodeId.length).toBe(1000)
        done()
      })

      progressEventEmitter.emitProgress(nodeId, state)
    })

    it('should handle empty string nodeId', done => {
      const nodeId = ''
      const state = 'running'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe('')
        done()
      })

      progressEventEmitter.emitProgress(nodeId, state)
    })

    it('should handle undefined metadata gracefully', done => {
      const nodeId = 'test-node-undefined-meta'
      const state = 'running'

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.state).toBe(state)
        expect(data.timestamp).toBeDefined()
        done()
      })

      progressEventEmitter.emitProgress(nodeId, state, undefined)
    })

    it('should handle error without message property', done => {
      const nodeId = 'test-node-error-no-msg'
      const error = {toString: () => 'Custom error'}

      progressEventEmitter.once('progress', data => {
        expect(data.nodeId).toBe(nodeId)
        expect(data.error).toBeUndefined()
        done()
      })

      progressEventEmitter.emitError(nodeId, error)
    })

    it('should handle error with empty message', done => {
      const nodeId = 'test-node-error-empty-msg'
      const error = new Error('')

      progressEventEmitter.once('progress', data => {
        expect(data.error).toBe('')
        done()
      })

      progressEventEmitter.emitError(nodeId, error)
    })
  })

  describe('multiple listeners', () => {
    it('should notify all registered listeners', done => {
      const nodeId = 'test-node-multi'
      const state = 'running'
      let listener1Called = false
      let listener2Called = false

      const listener1 = () => {
        listener1Called = true
      }
      const listener2 = () => {
        listener2Called = true
      }
      const listener3 = () => {
        expect(listener1Called).toBe(true)
        expect(listener2Called).toBe(true)
        done()
      }

      progressEventEmitter.once('progress', listener1)
      progressEventEmitter.once('progress', listener2)
      progressEventEmitter.once('progress', listener3)

      progressEventEmitter.emitProgress(nodeId, state)
    })

    it('should handle listener removal without affecting others', done => {
      const nodeId = 'test-node-removal'
      let listener1Count = 0
      let listener2Count = 0

      const listener1 = () => listener1Count++
      const listener2 = () => {
        listener2Count++
        if (listener2Count === 2) {
          expect(listener1Count).toBe(1)
          done()
        }
      }

      progressEventEmitter.on('progress', listener1)
      progressEventEmitter.on('progress', listener2)

      progressEventEmitter.emitProgress(nodeId, 'running')

      progressEventEmitter.removeListener('progress', listener1)

      progressEventEmitter.emitProgress(nodeId, 'idle')
    })
  })

  describe('rapid sequential events', () => {
    it('should handle rapid sequential events without data loss', done => {
      const nodeId = 'test-node-rapid'
      const events = []

      progressEventEmitter.on('progress', data => {
        events.push(data)
        if (events.length === 5) {
          expect(events[0].state).toBe('preparing')
          expect(events[1].state).toBe('running')
          expect(events[2].state).toBe('running')
          expect(events[3].state).toBe('running')
          expect(events[4].state).toBe('idle')
          progressEventEmitter.removeAllListeners('progress')
          done()
        }
      })

      progressEventEmitter.emitStart(nodeId)
      progressEventEmitter.emitRunning(nodeId)
      progressEventEmitter.emitRunning(nodeId)
      progressEventEmitter.emitRunning(nodeId)
      progressEventEmitter.emitComplete(nodeId)
    })

    it('should maintain timestamp ordering in rapid events', done => {
      const nodeId = 'test-node-timestamp-order'
      const timestamps = []

      progressEventEmitter.on('progress', data => {
        timestamps.push(data.timestamp)
        if (timestamps.length === 3) {
          expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1])
          expect(timestamps[1]).toBeLessThanOrEqual(timestamps[2])
          progressEventEmitter.removeAllListeners('progress')
          done()
        }
      })

      progressEventEmitter.emitStart(nodeId)
      progressEventEmitter.emitRunning(nodeId)
      progressEventEmitter.emitComplete(nodeId)
    })
  })

  describe('instance isolation', () => {
    it('should support multiple independent emitter instances', done => {
      const emitter1 = new ProgressEventEmitter()
      const emitter2 = new ProgressEventEmitter()

      let emitter1Called = false

      emitter1.once('progress', data => {
        expect(data.nodeId).toBe('node-1')
        emitter1Called = true
      })

      emitter2.once('progress', data => {
        expect(data.nodeId).toBe('node-2')
        expect(emitter1Called).toBe(true)
        done()
      })

      emitter1.emitProgress('node-1', 'running')
      emitter2.emitProgress('node-2', 'running')
    })
  })

  describe('state transitions', () => {
    it('should support complete lifecycle: start -> running -> complete', done => {
      const nodeId = 'test-node-lifecycle'
      const states = []

      progressEventEmitter.on('progress', data => {
        states.push(data.state)
        if (states.length === 3) {
          expect(states).toEqual(['preparing', 'running', 'idle'])
          progressEventEmitter.removeAllListeners('progress')
          done()
        }
      })

      progressEventEmitter.emitStart(nodeId)
      progressEventEmitter.emitRunning(nodeId)
      progressEventEmitter.emitComplete(nodeId)
    })

    it('should support error transition: start -> running -> error', done => {
      const nodeId = 'test-node-error-lifecycle'
      const states = []

      progressEventEmitter.on('progress', data => {
        states.push(data.state)
        if (states.length === 3) {
          expect(states).toEqual(['preparing', 'running', 'idle'])
          progressEventEmitter.removeAllListeners('progress')
          done()
        }
      })

      progressEventEmitter.emitStart(nodeId)
      progressEventEmitter.emitRunning(nodeId)
      progressEventEmitter.emitError(nodeId, new Error('Failed'))
    })
  })
})
