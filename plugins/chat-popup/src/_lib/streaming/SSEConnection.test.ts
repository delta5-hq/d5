import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { SSEConnection } from "./SSEConnection"
import { EventSourcePolyfill } from "event-source-polyfill"

vi.mock("event-source-polyfill", () => ({
  EventSourcePolyfill: vi.fn(),
}))

describe("SSEConnection", () => {
  let connection: SSEConnection
  let mockEventSource: any

  beforeEach(() => {
    mockEventSource = {
      close: vi.fn(),
      readyState: EventSource.OPEN,
      onmessage: null,
      onopen: null,
      onerror: null,
    }
    vi.mocked(EventSourcePolyfill).mockImplementation(function () {
      return mockEventSource
    })

    connection = new SSEConnection({
      sessionId: "test-session-id",
      apiVersion: "/api/v2",
      authToken: "test-token",
    })
  })

  afterEach(() => {
    connection.close()
    vi.clearAllMocks()
  })

  describe("open", () => {
    it("should create EventSource with correct URL", async () => {
      await connection.open()

      expect(EventSourcePolyfill).toHaveBeenCalledWith(
        expect.stringContaining("/api/v2/execute/stream"),
        expect.any(Object),
      )
    })

    it("should include sessionId in query string", async () => {
      await connection.open()

      const callArgs = vi.mocked(EventSourcePolyfill).mock.calls[0]
      expect(callArgs[0]).toContain("sessionId=test-session-id")
    })

    it("should encode special characters in sessionId", async () => {
      connection = new SSEConnection({
        sessionId: "test/session&id=123",
        apiVersion: "/api/v2",
        authToken: "test-token",
      })

      await connection.open()

      const callArgs = vi.mocked(EventSourcePolyfill).mock.calls[0]
      expect(callArgs[0]).toContain(encodeURIComponent("test/session&id=123"))
    })

    it("should set Authorization header with Bearer token", async () => {
      await connection.open()

      const callArgs = vi.mocked(EventSourcePolyfill).mock.calls[0]
      expect(callArgs[1]).toEqual({
        headers: {
          Authorization: "Bearer test-token",
        },
      })
    })

    it("should close existing connection before opening new one", async () => {
      await connection.open()
      const firstEventSource = mockEventSource

      mockEventSource = {
        close: vi.fn(),
        readyState: EventSource.OPEN,
        onmessage: null,
        onopen: null,
        onerror: null,
      }
      vi.mocked(EventSourcePolyfill).mockImplementation(function () {
      return mockEventSource
    })

      await connection.open()

      expect(firstEventSource.close).toHaveBeenCalled()
    })

    it("should attach onmessage handler", async () => {
      await connection.open()

      expect(mockEventSource.onmessage).toBeTypeOf("function")
    })
  })

  describe("waitForReady", () => {
    it("should resolve when EventSource opens successfully", async () => {
      await connection.open()

      const waitPromise = connection.waitForReady()
      mockEventSource.onopen()

      await expect(waitPromise).resolves.toBeUndefined()
    })

    it("should reject when EventSource is not initialized", async () => {
      await expect(connection.waitForReady()).rejects.toThrow("EventSource not initialized")
    })

    it("should reject on connection timeout", async () => {
      connection = new SSEConnection({
        sessionId: "test-session-id",
        apiVersion: "/api/v2",
        authToken: "test-token",
        openTimeoutMs: 100,
      })

      await connection.open()

      await expect(connection.waitForReady()).rejects.toThrow("SSE connection timeout")
    })

    it("should reject when connection fails", async () => {
      await connection.open()
      mockEventSource.readyState = EventSource.CLOSED

      const waitPromise = connection.waitForReady()
      mockEventSource.onerror()

      await expect(waitPromise).rejects.toThrow("SSE connection failed")
    })

    it("should clear timeout on successful open", async () => {
      vi.useFakeTimers()
      connection = new SSEConnection({
        sessionId: "test-session-id",
        apiVersion: "/api/v2",
        authToken: "test-token",
        openTimeoutMs: 1000,
      })

      await connection.open()
      const waitPromise = connection.waitForReady()

      mockEventSource.onopen()
      await waitPromise

      vi.advanceTimersByTime(2000)

      vi.useRealTimers()
    })

    it("should clear timeout on error", async () => {
      vi.useFakeTimers()
      connection = new SSEConnection({
        sessionId: "test-session-id",
        apiVersion: "/api/v2",
        authToken: "test-token",
        openTimeoutMs: 1000,
      })

      await connection.open()
      mockEventSource.readyState = EventSource.CLOSED

      const waitPromise = connection.waitForReady()
      mockEventSource.onerror()

      await expect(waitPromise).rejects.toThrow()

      vi.advanceTimersByTime(2000)

      vi.useRealTimers()
    })

    it("should use default timeout of 3000ms if not specified", async () => {
      vi.useFakeTimers()
      await connection.open()

      const waitPromise = connection.waitForReady()

      vi.advanceTimersByTime(2999)
      mockEventSource.onopen()
      await expect(waitPromise).resolves.toBeUndefined()

      vi.useRealTimers()
    })

    it("should not reject on non-closing errors", async () => {
      await connection.open()
      mockEventSource.readyState = EventSource.CONNECTING

      const waitPromise = connection.waitForReady()
      mockEventSource.onerror()

      vi.useFakeTimers()
      vi.advanceTimersByTime(100)
      mockEventSource.onopen()

      await expect(waitPromise).resolves.toBeUndefined()
      vi.useRealTimers()
    })
  })

  describe("onMessage", () => {
    it("should register message handler", () => {
      const handler = vi.fn()

      connection.onMessage(handler)

      expect(handler).not.toHaveBeenCalled()
    })

    it("should call handler when message is received", async () => {
      const handler = vi.fn()
      connection.onMessage(handler)

      await connection.open()

      const messageEvent = {
        data: JSON.stringify({ type: "progress", data: { message: "test" }, timestamp: Date.now() }),
      }

      mockEventSource.onmessage(messageEvent)

      expect(handler).toHaveBeenCalledWith({
        type: "progress",
        data: { message: "test" },
        timestamp: expect.any(Number),
      })
    })

    it("should handle malformed JSON gracefully", async () => {
      const handler = vi.fn()
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

      connection.onMessage(handler)
      await connection.open()

      const messageEvent = {
        data: "not valid json",
      }

      mockEventSource.onmessage(messageEvent)

      expect(handler).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalled()

      consoleError.mockRestore()
    })

    it("should not call handler if not registered", async () => {
      await connection.open()

      const messageEvent = {
        data: JSON.stringify({ type: "progress", data: { message: "test" }, timestamp: Date.now() }),
      }

      expect(() => mockEventSource.onmessage(messageEvent)).not.toThrow()
    })

    it("should handle all event types", async () => {
      const handler = vi.fn()
      connection.onMessage(handler)
      await connection.open()

      const eventTypes = ["progress", "update", "error", "complete"]

      eventTypes.forEach((type) => {
        const messageEvent = {
          data: JSON.stringify({ type, data: { test: true }, timestamp: Date.now() }),
        }
        mockEventSource.onmessage(messageEvent)
      })

      expect(handler).toHaveBeenCalledTimes(4)
    })

    it("should preserve complex nested data structures", async () => {
      const handler = vi.fn()
      connection.onMessage(handler)
      await connection.open()

      const complexData = {
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: "Hello",
          },
        },
      }

      const messageEvent = {
        data: JSON.stringify({ type: "update", data: complexData, timestamp: Date.now() }),
      }

      mockEventSource.onmessage(messageEvent)

      expect(handler).toHaveBeenCalledWith({
        type: "update",
        data: complexData,
        timestamp: expect.any(Number),
      })
    })

    it("should handle unicode and special characters", async () => {
      const handler = vi.fn()
      connection.onMessage(handler)
      await connection.open()

      const messageEvent = {
        data: JSON.stringify({
          type: "progress",
          data: { message: '测试 🎉 "quotes" and \n newlines' },
          timestamp: Date.now(),
        }),
      }

      mockEventSource.onmessage(messageEvent)

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { message: '测试 🎉 "quotes" and \n newlines' },
        }),
      )
    })
  })

  describe("close", () => {
    it("should close EventSource", async () => {
      await connection.open()

      connection.close()

      expect(mockEventSource.close).toHaveBeenCalled()
    })

    it("should clear message handler", async () => {
      const handler = vi.fn()
      connection.onMessage(handler)
      await connection.open()

      connection.close()

      const messageEvent = {
        data: JSON.stringify({ type: "progress", data: { message: "test" }, timestamp: Date.now() }),
      }

      mockEventSource.onmessage(messageEvent)

      expect(handler).not.toHaveBeenCalled()
    })

    it("should be idempotent", async () => {
      await connection.open()

      connection.close()
      connection.close()
      connection.close()

      expect(mockEventSource.close).toHaveBeenCalledTimes(1)
    })

    it("should not throw when called before open", () => {
      expect(() => connection.close()).not.toThrow()
    })
  })

  describe("isOpen", () => {
    it("should return true when EventSource is open", async () => {
      await connection.open()
      mockEventSource.readyState = EventSource.OPEN

      expect(connection.isOpen()).toBe(true)
    })

    it("should return false when EventSource is closed", async () => {
      await connection.open()
      mockEventSource.readyState = EventSource.CLOSED

      expect(connection.isOpen()).toBe(false)
    })

    it("should return false when EventSource is connecting", async () => {
      await connection.open()
      mockEventSource.readyState = EventSource.CONNECTING

      expect(connection.isOpen()).toBe(false)
    })

    it("should return false before open is called", () => {
      expect(connection.isOpen()).toBe(false)
    })

    it("should return false after close", async () => {
      await connection.open()
      connection.close()

      expect(connection.isOpen()).toBe(false)
    })
  })

  describe("lifecycle integration", () => {
    it("should handle full lifecycle: open -> wait -> message -> close", async () => {
      const handler = vi.fn()
      connection.onMessage(handler)

      await connection.open()

      const waitPromise = connection.waitForReady()
      mockEventSource.onopen()
      await waitPromise

      expect(connection.isOpen()).toBe(true)

      const messageEvent = {
        data: JSON.stringify({ type: "progress", data: { message: "test" }, timestamp: Date.now() }),
      }
      mockEventSource.onmessage(messageEvent)

      expect(handler).toHaveBeenCalled()

      connection.close()

      expect(connection.isOpen()).toBe(false)
    })

    it("should handle rapid open/close cycles", async () => {
      for (let i = 0; i < 5; i++) {
        mockEventSource = {
          close: vi.fn(),
          readyState: EventSource.OPEN,
          onmessage: null,
          onopen: null,
          onerror: null,
        }
        vi.mocked(EventSourcePolyfill).mockImplementation(function () {
      return mockEventSource
    })

        await connection.open()
        connection.close()
      }

      expect(connection.isOpen()).toBe(false)
    })

    it("should handle messages during connection phase", async () => {
      const handler = vi.fn()
      connection.onMessage(handler)

      await connection.open()

      const messageEvent = {
        data: JSON.stringify({ type: "progress", data: { message: "early" }, timestamp: Date.now() }),
      }
      mockEventSource.onmessage(messageEvent)

      const waitPromise = connection.waitForReady()
      mockEventSource.onopen()
      await waitPromise

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { message: "early" },
        }),
      )
    })
  })
})
