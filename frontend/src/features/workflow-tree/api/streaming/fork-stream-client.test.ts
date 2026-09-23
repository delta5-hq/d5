import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ForkStreamClient } from './fork-stream-client'

type MockEventSource = {
  onmessage: ((event: { data: string }) => void) | null
  onerror: (() => void) | null
  onopen: (() => void) | null
  close: ReturnType<typeof vi.fn>
  readyState: number
}

let mockInstance: MockEventSource

beforeEach(() => {
  mockInstance = {
    onmessage: null,
    onerror: null,
    onopen: null,
    close: vi.fn(),
    readyState: 0,
  }
  vi.stubGlobal(
    'EventSource',
    vi.fn(function () {
      return mockInstance
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ForkStreamClient', () => {
  describe('connect', () => {
    it('creates EventSource with sessionId in URL', () => {
      const client = new ForkStreamClient('sess-abc', { onForkEvent: vi.fn() })
      client.connect()
      expect(EventSource).toHaveBeenCalledWith(expect.stringContaining('sessionId=sess-abc'), expect.any(Object))
    })

    it('opens with withCredentials: true', () => {
      const client = new ForkStreamClient('sess-abc', { onForkEvent: vi.fn() })
      client.connect()
      expect(EventSource).toHaveBeenCalledWith(expect.any(String), { withCredentials: true })
    })

    it('does not create a second EventSource on repeated connect calls', () => {
      const client = new ForkStreamClient('sess-abc', { onForkEvent: vi.fn() })
      client.connect()
      client.connect()
      expect(EventSource).toHaveBeenCalledTimes(1)
    })

    it('URL-encodes special characters in sessionId', () => {
      const client = new ForkStreamClient('sess id=1&x=2', { onForkEvent: vi.fn() })
      client.connect()
      const [url] = vi.mocked(EventSource).mock.calls[0] as [string, ...unknown[]]
      expect(url).toContain(encodeURIComponent('sess id=1&x=2'))
      expect(url).not.toContain('sess id=1&x=2')
    })
  })

  describe('onmessage — update events', () => {
    it('calls onForkEvent for update-type messages', () => {
      const onForkEvent = vi.fn()
      const client = new ForkStreamClient('sess-1', { onForkEvent })
      client.connect()

      const forkEvent = { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 3 }
      mockInstance.onmessage?.({ data: JSON.stringify({ type: 'update', data: forkEvent }) })

      expect(onForkEvent).toHaveBeenCalledWith(forkEvent)
    })

    it('ignores complete-type messages (handled by POST response)', () => {
      const onForkEvent = vi.fn()
      const client = new ForkStreamClient('sess-1', { onForkEvent })
      client.connect()

      mockInstance.onmessage?.({ data: JSON.stringify({ type: 'complete', data: {} }) })

      expect(onForkEvent).not.toHaveBeenCalled()
    })

    it('ignores error-type messages (handled by POST response)', () => {
      const onForkEvent = vi.fn()
      const client = new ForkStreamClient('sess-1', { onForkEvent })
      client.connect()

      mockInstance.onmessage?.({ data: JSON.stringify({ type: 'error', data: { message: 'fail' } }) })

      expect(onForkEvent).not.toHaveBeenCalled()
    })

    it('calls onError for malformed JSON payloads', () => {
      const onError = vi.fn()
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn(), onError })
      client.connect()

      mockInstance.onmessage?.({ data: 'not-json' })

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('forwards each update event independently — multiple events invoke onForkEvent multiple times', () => {
      const onForkEvent = vi.fn()
      const client = new ForkStreamClient('sess-1', { onForkEvent })
      client.connect()

      const ev1 = { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 }
      const ev2 = { type: 'fork_settled', electNodeId: 'r1', forkIndex: 0, status: 'ok' }
      mockInstance.onmessage?.({ data: JSON.stringify({ type: 'update', data: ev1 }) })
      mockInstance.onmessage?.({ data: JSON.stringify({ type: 'update', data: ev2 }) })

      expect(onForkEvent).toHaveBeenCalledTimes(2)
      expect(onForkEvent).toHaveBeenNthCalledWith(1, ev1)
      expect(onForkEvent).toHaveBeenNthCalledWith(2, ev2)
    })
  })

  describe('onerror', () => {
    it('calls onError on EventSource error', () => {
      const onError = vi.fn()
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn(), onError })
      client.connect()

      mockInstance.onerror?.()

      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('does not throw when onError is not provided', () => {
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn() })
      client.connect()
      expect(() => mockInstance.onerror?.()).not.toThrow()
    })
  })

  describe('whenReady — gates the execute POST on SSE session registration', () => {
    it('resolves once the EventSource opens', async () => {
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn() })
      client.connect()

      let resolved = false
      const ready = client.whenReady().then(() => {
        resolved = true
      })
      await Promise.resolve()
      expect(resolved).toBe(false) // still waiting — session not open yet

      mockInstance.onopen?.()
      await ready
      expect(resolved).toBe(true)
    })

    it('resolves after the timeout when the connection never opens (best-effort — never blocks execution)', async () => {
      vi.useFakeTimers()
      try {
        const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn() })
        client.connect()

        let settled = false
        const ready = client.whenReady(3000).then(() => {
          settled = true
        })
        await vi.advanceTimersByTimeAsync(2999)
        expect(settled).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        await ready
        expect(settled).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('resolves immediately when connect was never called (nothing to wait for)', async () => {
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn() })
      await expect(client.whenReady()).resolves.toBeUndefined()
    })
  })

  describe('disconnect', () => {
    it('closes the EventSource', () => {
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn() })
      client.connect()
      client.disconnect()
      expect(mockInstance.close).toHaveBeenCalled()
    })

    it('allows reconnect after disconnect', () => {
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn() })
      client.connect()
      client.disconnect()

      const newInstance = { ...mockInstance, close: vi.fn() }
      vi.mocked(EventSource).mockImplementationOnce(function () {
        return newInstance as unknown as EventSource
      })
      client.connect()

      expect(EventSource).toHaveBeenCalledTimes(2)
    })

    it('disconnect when not yet connected is a safe no-op', () => {
      const client = new ForkStreamClient('sess-1', { onForkEvent: vi.fn() })
      expect(() => client.disconnect()).not.toThrow()
    })
  })
})
