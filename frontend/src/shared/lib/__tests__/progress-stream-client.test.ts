/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProgressStreamClient } from '../progress-stream-client'
import type { GenieState } from '@shared/ui/genie'

describe('ProgressStreamClient', () => {
  let mockEventSource: any
  let client: ProgressStreamClient
  let onProgressMock: (nodeId: string, state: GenieState) => void

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
    it('should parse and forward progress events', () => {
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

      expect(onProgressMock).toHaveBeenCalledWith('test-node-123', 'running')
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
      expect(onProgressMock).toHaveBeenNthCalledWith(1, 'node-1', 'preparing')
      expect(onProgressMock).toHaveBeenNthCalledWith(2, 'node-1', 'running')
      expect(onProgressMock).toHaveBeenNthCalledWith(3, 'node-1', 'idle')
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

  describe('edge cases', () => {
    it('should handle very long nodeId', () => {
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

      expect(onProgressMock).toHaveBeenCalledWith(longNodeId, 'running')
    })

    it('should handle special characters in nodeId', () => {
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

      expect(onProgressMock).toHaveBeenCalledWith(specialNodeId, 'running')
    })
  })
})
