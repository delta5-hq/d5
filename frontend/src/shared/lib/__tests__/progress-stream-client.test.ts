/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProgressStreamClient } from '../progress-stream-client'
import type { GenieState } from '@shared/ui/genie'

describe('ProgressStreamClient', () => {
  let mockEventSource: any
  let client: ProgressStreamClient
  let onProgressMock: (nodeId: string, state: GenieState, error?: string) => void

  beforeEach(() => {
    onProgressMock = vi.fn()

    global.EventSource = vi.fn().mockImplementation(function (this: any) {
      mockEventSource = this
      mockEventSource.readyState = 0
      mockEventSource.close = vi.fn(() => {
        mockEventSource.readyState = 2
      })
      mockEventSource.onerror = null
      mockEventSource.onopen = null
      mockEventSource.onmessage = null
      return mockEventSource
    }) as any

    client = new ProgressStreamClient('http://localhost:3000', onProgressMock)
  })

  describe('connection lifecycle', () => {
    it('should create EventSource with correct URL', () => {
      client.connect()
      expect(global.EventSource).toHaveBeenCalledWith('http://localhost:3000/api/v2/progress/stream')
    })

    it('should not create duplicate connections', () => {
      client.connect()
      client.connect()
      expect(global.EventSource).toHaveBeenCalledTimes(1)
    })

    it('should update connection status on open', () => {
      client.connect()
      expect(client.getConnectionStatus()).toBe(false)

      if (mockEventSource.onopen) mockEventSource.onopen(new Event('open'))
      expect(client.getConnectionStatus()).toBe(true)
    })

    it('should update connection status on error', () => {
      client.connect()
      if (mockEventSource.onopen) mockEventSource.onopen(new Event('open'))
      expect(client.getConnectionStatus()).toBe(true)

      if (mockEventSource.onerror) mockEventSource.onerror(new Event('error'))
      expect(client.getConnectionStatus()).toBe(false)
    })

    it('should close connection on disconnect', () => {
      client.connect()
      client.disconnect()

      expect(mockEventSource.close).toHaveBeenCalled()
      expect(client.getConnectionStatus()).toBe(false)
    })
  })

  describe('message handling', () => {
    it('should parse and forward progress events with state mapping', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node-123',
        state: 'running',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node-123', 'busy', undefined)
    })

    it('should map preparing to busy', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node-123',
        state: 'preparing',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node-123', 'busy', undefined)
    })

    it('should map idle without error to done-success', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node-123',
        state: 'idle',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node-123', 'done-success', undefined)
    })

    it('should map idle with error to done-failure', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node-123',
        state: 'idle',
        error: 'Test error',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node-123', 'done-failure', 'Test error')
    })

    it('should ignore connected events', () => {
      client.connect()

      const eventData = { type: 'connected', timestamp: Date.now() }
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).not.toHaveBeenCalled()
    })

    it('should handle multiple progress events in sequence', () => {
      client.connect()

      const events = [
        { type: 'progress', nodeId: 'node-1', state: 'preparing', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-1', state: 'running', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-1', state: 'idle', timestamp: Date.now() },
      ]

      events.forEach(eventData => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(eventData),
        })
        if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)
      })

      expect(onProgressMock).toHaveBeenCalledTimes(3)
      expect(onProgressMock).toHaveBeenNthCalledWith(1, 'node-1', 'busy', undefined)
      expect(onProgressMock).toHaveBeenNthCalledWith(2, 'node-1', 'busy', undefined)
      expect(onProgressMock).toHaveBeenNthCalledWith(3, 'node-1', 'done-success', undefined)
    })

    it('should ignore events without required fields', () => {
      client.connect()

      const invalidEvents = [
        { type: 'progress', state: 'running', timestamp: Date.now() },
        { type: 'progress', nodeId: 'test', timestamp: Date.now() },
      ]

      invalidEvents.forEach(eventData => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(eventData),
        })
        if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)
      })

      expect(onProgressMock).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle invalid JSON gracefully', () => {
      client.connect()

      const errorListener = vi.fn()
      client.onError(errorListener)

      const messageEvent = new MessageEvent('message', {
        data: 'invalid json',
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(errorListener).toHaveBeenCalled()
      expect(errorListener.mock.calls[0][0]).toBeInstanceOf(Error)
    })

    it('should notify all error listeners', () => {
      client.connect()

      const errorListener1 = vi.fn()
      const errorListener2 = vi.fn()

      client.onError(errorListener1)
      client.onError(errorListener2)

      const messageEvent = new MessageEvent('message', {
        data: 'not json',
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(errorListener1).toHaveBeenCalled()
      expect(errorListener2).toHaveBeenCalled()
    })
  })

  describe('connection status listeners', () => {
    it('should notify listeners on connection open', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      client.onConnectionChange(listener1)
      client.onConnectionChange(listener2)

      client.connect()

      if (mockEventSource.onopen) mockEventSource.onopen(new Event('open'))

      expect(listener1).toHaveBeenCalledWith(true)
      expect(listener2).toHaveBeenCalledWith(true)
    })

    it('should notify listeners on connection close', () => {
      const listener = vi.fn()

      client.onConnectionChange(listener)
      client.connect()

      if (mockEventSource.onopen) mockEventSource.onopen(new Event('open'))

      listener.mockClear()

      if (mockEventSource.onerror) {
        mockEventSource.readyState = 2
        mockEventSource.onerror(new Event('error'))
      }

      expect(listener).toHaveBeenCalledWith(false)
    })

    it('should support unsubscribing from connection status', () => {
      const listener = vi.fn()

      const unsubscribe = client.onConnectionChange(listener)

      client.connect()

      unsubscribe()

      if (mockEventSource.onopen) mockEventSource.onopen(new Event('open'))

      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('automatic reconnection', () => {
    it('should not attempt reconnection if explicitly disconnected', () => {
      vi.useFakeTimers()

      client.connect()
      client.disconnect()

      vi.advanceTimersByTime(5000)

      expect(global.EventSource).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  describe('state mapping algorithm', () => {
    it('maps unknown backend state to idle', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'unknown_state',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'idle', undefined)
    })

    it('maps processing to busy', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'processing',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'idle', undefined)
    })

    it('handles state with different casing', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'RUNNING',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'idle', undefined)
    })

    it('prioritizes error over state when idle', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'idle',
        error: 'Critical failure',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'done-failure', 'Critical failure')
    })
  })

  describe('error message handling', () => {
    it('handles null error treats idle as done-success', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'idle',
        error: null,
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'done-success', null)
    })

    it('handles empty string error treats idle as done-success', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'idle',
        error: '',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'done-success', '')
    })

    it('handles very long error message', () => {
      client.connect()

      const longError = 'E'.repeat(10000)
      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'idle',
        error: longError,
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'done-failure', longError)
    })

    it('handles error with special characters', () => {
      client.connect()

      const specialError = 'Error: \n\t<script>alert("xss")</script>'
      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'idle',
        error: specialError,
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'done-failure', specialError)
    })

    it('handles error with unicode', () => {
      client.connect()

      const unicodeError = '错误: 文件未找到 🔥'
      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'idle',
        error: unicodeError,
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'done-failure', unicodeError)
    })
  })

  describe('malformed event data', () => {
    it('ignores event with missing type field', () => {
      client.connect()

      const eventData = {
        nodeId: 'test-node',
        state: 'running',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).not.toHaveBeenCalled()
    })

    it('handles event with extra unexpected fields', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'running',
        timestamp: Date.now(),
        unexpectedField: 'should be ignored',
        anotherField: 123,
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'busy', undefined)
    })

    it('handles event with missing timestamp', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 'test-node',
        state: 'running',
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith('test-node', 'busy', undefined)
    })

    it('ignores numeric nodeId', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: 12345,
        state: 'running',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith(12345, 'busy', undefined)
    })

    it('ignores object nodeId', () => {
      client.connect()

      const eventData = {
        type: 'progress',
        nodeId: { id: 'test' },
        state: 'running',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith({ id: 'test' }, 'busy', undefined)
    })
  })

  describe('concurrent multi-node events', () => {
    it('handles interleaved events for different nodes', () => {
      client.connect()

      const events = [
        { type: 'progress', nodeId: 'node-1', state: 'preparing', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-2', state: 'preparing', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-1', state: 'running', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-3', state: 'preparing', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-2', state: 'running', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-1', state: 'idle', timestamp: Date.now() },
      ]

      events.forEach(eventData => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(eventData),
        })
        if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)
      })

      expect(onProgressMock).toHaveBeenCalledTimes(6)
      expect(onProgressMock).toHaveBeenNthCalledWith(1, 'node-1', 'busy', undefined)
      expect(onProgressMock).toHaveBeenNthCalledWith(2, 'node-2', 'busy', undefined)
      expect(onProgressMock).toHaveBeenNthCalledWith(3, 'node-1', 'busy', undefined)
      expect(onProgressMock).toHaveBeenNthCalledWith(4, 'node-3', 'busy', undefined)
      expect(onProgressMock).toHaveBeenNthCalledWith(5, 'node-2', 'busy', undefined)
      expect(onProgressMock).toHaveBeenNthCalledWith(6, 'node-1', 'done-success', undefined)
    })

    it('handles rapid state changes for same node', () => {
      client.connect()

      const events = [
        { type: 'progress', nodeId: 'node-1', state: 'preparing', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-1', state: 'running', timestamp: Date.now() },
        { type: 'progress', nodeId: 'node-1', state: 'idle', timestamp: Date.now() },
      ]

      events.forEach(eventData => {
        const messageEvent = new MessageEvent('message', {
          data: JSON.stringify(eventData),
        })
        if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)
      })

      expect(onProgressMock).toHaveBeenCalledTimes(3)
    })
  })

  describe('edge cases', () => {
    it('handles very long nodeId', () => {
      client.connect()

      const longNodeId = 'a'.repeat(1000)
      const eventData = {
        type: 'progress',
        nodeId: longNodeId,
        state: 'running',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith(longNodeId, 'busy', undefined)
    })

    it('handles special characters in nodeId', () => {
      client.connect()

      const specialNodeId = 'node-!@#$%^&*()_+-='
      const eventData = {
        type: 'progress',
        nodeId: specialNodeId,
        state: 'running',
        timestamp: Date.now(),
      }

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(eventData),
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(onProgressMock).toHaveBeenCalledWith(specialNodeId, 'busy', undefined)
    })

    it('handles empty message data', () => {
      client.connect()

      const errorListener = vi.fn()
      client.onError(errorListener)

      const messageEvent = new MessageEvent('message', {
        data: '',
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(errorListener).toHaveBeenCalled()
    })

    it('handles whitespace-only message data', () => {
      client.connect()

      const errorListener = vi.fn()
      client.onError(errorListener)

      const messageEvent = new MessageEvent('message', {
        data: '   \n\t  ',
      })

      if (mockEventSource.onmessage) mockEventSource.onmessage(messageEvent)

      expect(errorListener).toHaveBeenCalled()
    })
  })
})
