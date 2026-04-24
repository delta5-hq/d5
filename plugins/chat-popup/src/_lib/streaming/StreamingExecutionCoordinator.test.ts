import { describe, it, expect, beforeEach, vi } from "vitest"
import { StreamingExecutionCoordinator } from "./StreamingExecutionCoordinator"
import { SSEConnection } from "./SSEConnection"
import { ProgressFormatter } from "./ProgressFormatter"

vi.mock("./SSEConnection", () => ({
  SSEConnection: vi.fn(),
}))
vi.mock("./ProgressFormatter", () => ({
  ProgressFormatter: vi.fn(),
}))

describe("StreamingExecutionCoordinator", () => {
  let coordinator: StreamingExecutionCoordinator
  let mockConnection: any
  let mockFormatter: any
  let mockExecuteRequest: any

  beforeEach(() => {
    mockConnection = {
      open: vi.fn().mockResolvedValue(undefined),
      waitForReady: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(),
      close: vi.fn(),
      isOpen: vi.fn().mockReturnValue(true),
    }

    mockFormatter = {
      formatProgress: vi.fn((msg) => ({ type: "status", text: msg })),
      formatUpdate: vi.fn((data) => ({ type: "content", text: "update" })),
      formatError: vi.fn((err) => ({ type: "status", text: `Error: ${err.message}` })),
    }

    vi.mocked(SSEConnection).mockImplementation(function () {
      return mockConnection
    })
    vi.mocked(ProgressFormatter).mockImplementation(function () {
      return mockFormatter
    })

    mockExecuteRequest = vi.fn().mockResolvedValue([{ id: "test", title: "result" }])

    coordinator = new StreamingExecutionCoordinator()
  })

  describe("execute without streaming (no onProgress callback)", () => {
    it("should execute request without establishing SSE", async () => {
      const result = await coordinator.execute({
        apiVersion: "/api/v2",
        authToken: "test-token",
        payload: { test: "data" },
        executeRequest: mockExecuteRequest,
      })

      expect(mockConnection.open).not.toHaveBeenCalled()
      expect(mockConnection.waitForReady).not.toHaveBeenCalled()
      expect(mockExecuteRequest).toHaveBeenCalledWith({ test: "data" })
      expect(result).toEqual([{ id: "test", title: "result" }])
    })

    it("should not include streamSessionId in payload", async () => {
      await coordinator.execute({
        apiVersion: "/api/v2",
        authToken: "test-token",
        payload: { test: "data" },
        executeRequest: mockExecuteRequest,
      })

      expect(mockExecuteRequest).toHaveBeenCalledWith({ test: "data" })
      expect(mockExecuteRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ streamSessionId: expect.anything() }),
      )
    })

    it("should close connection even without streaming", async () => {
      await coordinator.execute({
        apiVersion: "/api/v2",
        authToken: "test-token",
        payload: { test: "data" },
        executeRequest: mockExecuteRequest,
      })

      expect(mockConnection.close).toHaveBeenCalled()
    })
  })

  describe("execute with streaming (onProgress callback provided)", () => {
    it("should establish SSE connection", async () => {
      const onProgress = vi.fn()

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: { test: "data" },
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(mockConnection.open).toHaveBeenCalled()
      expect(mockConnection.waitForReady).toHaveBeenCalled()
    })

    it("should include streamSessionId in payload when streaming", async () => {
      const onProgress = vi.fn()

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: { test: "data" },
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(mockExecuteRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          test: "data",
          streamSessionId: expect.any(String),
        }),
      )
    })

    it("should generate unique session IDs", async () => {
      const onProgress = vi.fn()
      const sessionIds: string[] = []

      mockExecuteRequest.mockImplementation((payload: any) => {
        sessionIds.push(payload.streamSessionId)
        return Promise.resolve([])
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(sessionIds).toHaveLength(2)
      expect(sessionIds[0]).not.toBe(sessionIds[1])
    })

    it("should attach message handlers", async () => {
      const onProgress = vi.fn()

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(mockConnection.onMessage).toHaveBeenCalledWith(expect.any(Function))
    })

    it("should call onProgress for progress events", async () => {
      const onProgress = vi.fn()
      let messageHandler: any

      mockConnection.onMessage.mockImplementation((handler: any) => {
        messageHandler = handler
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      messageHandler({
        type: "progress",
        data: { message: "Started: ClaudeCommand.run" },
        timestamp: Date.now(),
      })

      expect(mockFormatter.formatProgress).toHaveBeenCalledWith("Started: ClaudeCommand.run")
      expect(onProgress).toHaveBeenCalledWith({
        type: "status",
        text: "Started: ClaudeCommand.run",
      })
    })

    it("should call onProgress for update events", async () => {
      const onProgress = vi.fn()
      let messageHandler: any

      mockConnection.onMessage.mockImplementation((handler: any) => {
        messageHandler = handler
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      messageHandler({
        type: "update",
        data: { update: { sessionUpdate: "agent_message_chunk", content: { text: "Hello" } } },
        timestamp: Date.now(),
      })

      expect(mockFormatter.formatUpdate).toHaveBeenCalled()
      expect(onProgress).toHaveBeenCalledWith({
        type: "content",
        text: "update",
      })
    })

    it("should not call onProgress for update events that format to null", async () => {
      const onProgress = vi.fn()
      let messageHandler: any

      mockFormatter.formatUpdate.mockReturnValue(null)

      mockConnection.onMessage.mockImplementation((handler: any) => {
        messageHandler = handler
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      messageHandler({
        type: "update",
        data: { update: { sessionUpdate: "tool_call_update" } },
        timestamp: Date.now(),
      })

      expect(mockFormatter.formatUpdate).toHaveBeenCalled()
      expect(onProgress).not.toHaveBeenCalled()
    })

    it("should call onProgress for error events and close connection", async () => {
      const onProgress = vi.fn()
      let messageHandler: any

      mockConnection.onMessage.mockImplementation((handler: any) => {
        messageHandler = handler
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      messageHandler({
        type: "error",
        data: { message: "Test error", stack: "..." },
        timestamp: Date.now(),
      })

      expect(mockFormatter.formatError).toHaveBeenCalledWith({ message: "Test error", stack: "..." })
      expect(onProgress).toHaveBeenCalled()
      expect(mockConnection.close).toHaveBeenCalledTimes(2)
    })

    it("should close connection on complete event", async () => {
      const onProgress = vi.fn()
      let messageHandler: any

      mockConnection.onMessage.mockImplementation((handler: any) => {
        messageHandler = handler
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      messageHandler({
        type: "complete",
        data: { result: "done" },
        timestamp: Date.now(),
      })

      expect(mockConnection.close).toHaveBeenCalledTimes(2)
    })

    it("should not call onProgress for complete event", async () => {
      const onProgress = vi.fn()
      let messageHandler: any

      mockConnection.onMessage.mockImplementation((handler: any) => {
        messageHandler = handler
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      messageHandler({
        type: "complete",
        data: { result: "done" },
        timestamp: Date.now(),
      })

      expect(onProgress).not.toHaveBeenCalled()
    })
  })

  describe("fallback to POST-only on SSE failure", () => {
    it("should fall back to POST-only if SSE open fails", async () => {
      const onProgress = vi.fn()
      mockConnection.open.mockRejectedValue(new Error("Connection failed"))

      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

      const result = await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: { test: "data" },
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(consoleWarn).toHaveBeenCalledWith(
        "SSE unavailable, falling back to POST-only:",
        expect.any(Error),
      )
      expect(mockExecuteRequest).toHaveBeenCalledWith({ test: "data" })
      expect(result).toEqual([{ id: "test", title: "result" }])

      consoleWarn.mockRestore()
    })

    it("should fall back to POST-only if waitForReady fails", async () => {
      const onProgress = vi.fn()
      mockConnection.waitForReady.mockRejectedValue(new Error("Timeout"))

      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: { test: "data" },
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(consoleWarn).toHaveBeenCalled()
      expect(mockExecuteRequest).toHaveBeenCalledWith({ test: "data" })

      consoleWarn.mockRestore()
    })

    it("should not include streamSessionId when fallback occurs", async () => {
      const onProgress = vi.fn()
      mockConnection.waitForReady.mockRejectedValue(new Error("Timeout"))

      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: { test: "data" },
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(mockExecuteRequest).toHaveBeenCalledWith({ test: "data" })
      expect(mockExecuteRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ streamSessionId: expect.anything() }),
      )

      consoleWarn.mockRestore()
    })

    it("should not attach message handlers when fallback occurs", async () => {
      const onProgress = vi.fn()
      mockConnection.open.mockRejectedValue(new Error("Failed"))

      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {})

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(mockConnection.onMessage).not.toHaveBeenCalled()

      consoleWarn.mockRestore()
    })
  })

  describe("connection lifecycle management", () => {
    it("should always close connection in finally block", async () => {
      await coordinator.execute({
        apiVersion: "/api/v2",
        authToken: "test-token",
        payload: {},
        executeRequest: mockExecuteRequest,
      })

      expect(mockConnection.close).toHaveBeenCalled()
    })

    it("should close connection even if execute request fails", async () => {
      mockExecuteRequest.mockRejectedValue(new Error("Execute failed"))

      await expect(
        coordinator.execute({
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        }),
      ).rejects.toThrow("Execute failed")

      expect(mockConnection.close).toHaveBeenCalled()
    })

    it("should close connection even if SSE succeeds but execute fails", async () => {
      const onProgress = vi.fn()
      mockExecuteRequest.mockRejectedValue(new Error("Execute failed"))

      await expect(
        coordinator.execute(
          {
            apiVersion: "/api/v2",
            authToken: "test-token",
            payload: {},
            executeRequest: mockExecuteRequest,
          },
          onProgress,
        ),
      ).rejects.toThrow("Execute failed")

      expect(mockConnection.open).toHaveBeenCalled()
      expect(mockConnection.close).toHaveBeenCalled()
    })

    it("should create new connection for each execute call", async () => {
      const onProgress = vi.fn()

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(SSEConnection).toHaveBeenCalledTimes(2)
    })
  })

  describe("session ID generation", () => {
    it("should generate UUID-like session IDs", async () => {
      const onProgress = vi.fn()
      let sessionId: string | undefined

      mockExecuteRequest.mockImplementation((payload: any) => {
        sessionId = payload.streamSessionId
        return Promise.resolve([])
      })

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe("string")
      expect(sessionId!.length).toBeGreaterThan(0)
    })

    it("should handle environments without crypto.randomUUID", async () => {
      const originalCrypto = global.crypto
      delete (global as any).crypto

      const onProgress = vi.fn()
      let sessionId: string | undefined

      mockExecuteRequest.mockImplementation((payload: any) => {
        sessionId = payload.streamSessionId
        return Promise.resolve([])
      })

      try {
        await coordinator.execute(
          {
            apiVersion: "/api/v2",
            authToken: "test-token",
            payload: {},
            executeRequest: mockExecuteRequest,
          },
          onProgress,
        )

        expect(sessionId).toBeDefined()
        expect(typeof sessionId).toBe("string")
      } finally {
        ;(global as any).crypto = originalCrypto
      }
    })
  })

  describe("payload preservation", () => {
    it("should preserve original payload properties", async () => {
      const onProgress = vi.fn()
      const originalPayload = {
        queryType: "claude",
        cell: { id: "test" },
        workflowNodes: {},
      }

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: originalPayload,
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(mockExecuteRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          queryType: "claude",
          cell: { id: "test" },
          workflowNodes: {},
        }),
      )
    })

    it("should not mutate original payload object", async () => {
      const onProgress = vi.fn()
      const originalPayload = { test: "data" }
      const originalPayloadCopy = { ...originalPayload }

      await coordinator.execute(
        {
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: originalPayload,
          executeRequest: mockExecuteRequest,
        },
        onProgress,
      )

      expect(originalPayload).toEqual(originalPayloadCopy)
    })
  })

  describe("execution result handling", () => {
    it("should return execute request result unchanged", async () => {
      const expectedResult = [
        { id: "node1", title: "Node 1" },
        { id: "node2", title: "Node 2" },
      ]

      mockExecuteRequest.mockResolvedValue(expectedResult)

      const result = await coordinator.execute({
        apiVersion: "/api/v2",
        authToken: "test-token",
        payload: {},
        executeRequest: mockExecuteRequest,
      })

      expect(result).toBe(expectedResult)
    })

    it("should propagate execute request errors", async () => {
      mockExecuteRequest.mockRejectedValue(new Error("Execution failed"))

      await expect(
        coordinator.execute({
          apiVersion: "/api/v2",
          authToken: "test-token",
          payload: {},
          executeRequest: mockExecuteRequest,
        }),
      ).rejects.toThrow("Execution failed")
    })
  })

  describe("concurrent execution", () => {
    it("should handle multiple concurrent executions", async () => {
      const onProgress = vi.fn()

      const promises = [
        coordinator.execute(
          {
            apiVersion: "/api/v2",
            authToken: "token1",
            payload: { id: 1 },
            executeRequest: vi.fn().mockResolvedValue([{ id: "result1" }]),
          },
          onProgress,
        ),
        coordinator.execute(
          {
            apiVersion: "/api/v2",
            authToken: "token2",
            payload: { id: 2 },
            executeRequest: vi.fn().mockResolvedValue([{ id: "result2" }]),
          },
          onProgress,
        ),
        coordinator.execute(
          {
            apiVersion: "/api/v2",
            authToken: "token3",
            payload: { id: 3 },
            executeRequest: vi.fn().mockResolvedValue([{ id: "result3" }]),
          },
          onProgress,
        ),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(SSEConnection).toHaveBeenCalledTimes(3)
    })
  })
})
