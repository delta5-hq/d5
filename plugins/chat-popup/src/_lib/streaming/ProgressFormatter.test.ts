import { describe, it, expect, beforeEach } from "vitest"
import { ProgressFormatter } from "./ProgressFormatter"

describe("ProgressFormatter", () => {
  let formatter: ProgressFormatter

  beforeEach(() => {
    formatter = new ProgressFormatter()
  })

  describe("formatProgress", () => {
    describe("command label humanization", () => {
      const testCases = [
        { input: "Started: RPCCommand.run", expected: "Running remote command..." },
        { input: "Started: ClaudeCommand.run", expected: "Asking Claude..." },
        { input: "Started: ChatCommand.run", expected: "Asking ChatGPT..." },
        { input: "Started: QwenCommand.run", expected: "Asking Qwen..." },
        { input: "Started: DeepseekCommand.run", expected: "Asking Deepseek..." },
        { input: "Started: PerplexityCommand.run", expected: "Asking Perplexity..." },
        { input: "Started: YandexCommand.run", expected: "Asking YandexGPT..." },
        { input: "Started: CustomLLMChatCommand.run", expected: "Asking custom LLM..." },
        { input: "Started: WebCommand.run", expected: "Searching web..." },
        { input: "Started: ScholarCommand.run", expected: "Searching academic papers..." },
        { input: "Started: OutlineCommand.run", expected: "Generating outline..." },
        { input: "Started: SummarizeCommand.run", expected: "Summarizing..." },
        { input: "Started: ForeachCommand.run", expected: "Processing items..." },
        { input: "Started: StepsCommand.run", expected: "Executing steps..." },
        { input: "Started: SwitchCommand.run", expected: "Evaluating conditions..." },
        { input: "Started: MCPCommand.run", expected: "Running integration..." },
        { input: "Started: ExtCommand.run", expected: "Querying knowledge base..." },
        { input: "Started: MemorizeCommand.run", expected: "Storing in memory..." },
        { input: "Started: DownloadCommand.run", expected: "Downloading content..." },
        { input: "Started: RefineCommand.run", expected: "Refining output..." },
        { input: "Started: CompletionCommand.run", expected: "Running completion..." },
      ]

      testCases.forEach(({ input, expected }) => {
        it(`should format "${input}" to "${expected}"`, () => {
          const result = formatter.formatProgress(input)

          expect(result).toEqual({
            type: "status",
            text: expected,
          })
        })
      })
    })

    describe("completed command labels", () => {
      const testCases = [
        { input: "Completed: RPCCommand.run", expected: "Command completed" },
        { input: "Completed: ClaudeCommand.run", expected: "Claude responded" },
        { input: "Completed: ChatCommand.run", expected: "ChatGPT responded" },
        { input: "Completed: WebCommand.run", expected: "Web search completed" },
        { input: "Completed: ForeachCommand.run", expected: "Processing completed" },
      ]

      testCases.forEach(({ input, expected }) => {
        it(`should format "${input}" to "${expected}"`, () => {
          const result = formatter.formatProgress(input)

          expect(result).toEqual({
            type: "status",
            text: expected,
          })
        })
      })
    })

    it("should handle unknown command types gracefully", () => {
      const result = formatter.formatProgress("Started: UnknownCommand.run")

      expect(result).toEqual({
        type: "status",
        text: "Running UnknownCommand...",
      })
    })

    it("should handle non-standard format by stripping prefixes", () => {
      const result = formatter.formatProgress("Started: Some random label")

      expect(result).toEqual({
        type: "status",
        text: "Some random label",
      })
    })

    it("should strip Command suffix from unknown commands", () => {
      const result = formatter.formatProgress("Started: CustomCommand.run")

      expect(result).toEqual({
        type: "status",
        text: "Running CustomCommand...",
      })
    })

    it("should return status message type", () => {
      const result = formatter.formatProgress("Started: ClaudeCommand.run")

      expect(result.type).toBe("status")
    })

    it("should handle empty string", () => {
      const result = formatter.formatProgress("")

      expect(result).toEqual({
        type: "status",
        text: "",
      })
    })

    it("should handle messages without prefixes", () => {
      const result = formatter.formatProgress("Processing data")

      expect(result).toEqual({
        type: "status",
        text: "Processing data",
      })
    })
  })

  describe("formatUpdate", () => {
    describe("agent_message_chunk", () => {
      it("should extract text from agent message chunk", () => {
        const data = {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: "Hello, world!",
            },
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toEqual({
          type: "content",
          text: "Hello, world!",
        })
      })

      it("should return null for empty text", () => {
        const data = {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: "",
            },
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toBeNull()
      })

      it("should return null for undefined text", () => {
        const data = {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: undefined,
            },
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toBeNull()
      })

      it("should handle multi-line text", () => {
        const data = {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: "Line 1\nLine 2\nLine 3",
            },
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toEqual({
          type: "content",
          text: "Line 1\nLine 2\nLine 3",
        })
      })

      it("should handle unicode and emoji", () => {
        const data = {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: "测试 🎉 émoji",
            },
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toEqual({
          type: "content",
          text: "测试 🎉 émoji",
        })
      })

      it("should return content type", () => {
        const data = {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: "Test",
            },
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result?.type).toBe("content")
      })
    })

    describe("tool_call", () => {
      it("should format tool call with title", () => {
        const data = {
          update: {
            sessionUpdate: "tool_call",
            name: "read_file",
            title: "Read File",
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toEqual({
          type: "status",
          text: "🔧 Read File",
        })
      })

      it("should use name as fallback when title is missing", () => {
        const data = {
          update: {
            sessionUpdate: "tool_call",
            name: "write_file",
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toEqual({
          type: "status",
          text: "🔧 write_file",
        })
      })

      it("should return null when both name and title are missing", () => {
        const data = {
          update: {
            sessionUpdate: "tool_call",
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toBeNull()
      })

      it("should prefer title over name", () => {
        const data = {
          update: {
            sessionUpdate: "tool_call",
            name: "some_tool_name",
            title: "User Friendly Name",
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toEqual({
          type: "status",
          text: "🔧 User Friendly Name",
        })
      })
    })

    describe("tool_call_update", () => {
      it("should return null for tool_call_update", () => {
        const data = {
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: "tool-1",
            status: "completed",
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toBeNull()
      })
    })

    describe("unknown update types", () => {
      it("should return null for unknown sessionUpdate type", () => {
        const data = {
          update: {
            sessionUpdate: "unknown_type",
            data: "something",
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toBeNull()
      })

      it("should return null for missing sessionUpdate", () => {
        const data = {
          update: {},
        }

        const result = formatter.formatUpdate(data)

        expect(result).toBeNull()
      })

      it("should return null for missing update field", () => {
        const data = {}

        const result = formatter.formatUpdate(data)

        expect(result).toBeNull()
      })

      it("should handle null data", () => {
        const result = formatter.formatUpdate(null)

        expect(result).toBeNull()
      })

      it("should handle undefined data", () => {
        const result = formatter.formatUpdate(undefined)

        expect(result).toBeNull()
      })

      it("should handle non-object data", () => {
        const result = formatter.formatUpdate("string")

        expect(result).toBeNull()
      })
    })

    describe("complex nested structures", () => {
      it("should handle deeply nested update data", () => {
        const data = {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              type: "text",
              text: "Nested content",
              metadata: {
                level1: {
                  level2: {
                    value: "deep",
                  },
                },
              },
            },
          },
        }

        const result = formatter.formatUpdate(data)

        expect(result).toEqual({
          type: "content",
          text: "Nested content",
        })
      })
    })
  })

  describe("formatError", () => {
    it("should format error with message", () => {
      const errorData = {
        message: "Something went wrong",
        stack: "Error: Something went wrong\n  at ...",
      }

      const result = formatter.formatError(errorData)

      expect(result).toEqual({
        type: "status",
        text: "Error: Something went wrong",
      })
    })

    it("should format error without stack", () => {
      const errorData = {
        message: "Network error",
      }

      const result = formatter.formatError(errorData)

      expect(result).toEqual({
        type: "status",
        text: "Error: Network error",
      })
    })

    it("should return status message type", () => {
      const errorData = {
        message: "Test error",
      }

      const result = formatter.formatError(errorData)

      expect(result.type).toBe("status")
    })

    it("should handle empty message", () => {
      const errorData = {
        message: "",
      }

      const result = formatter.formatError(errorData)

      expect(result).toEqual({
        type: "status",
        text: "Error: ",
      })
    })

    it("should handle multi-line error messages", () => {
      const errorData = {
        message: "Error on line 1\nError on line 2",
      }

      const result = formatter.formatError(errorData)

      expect(result).toEqual({
        type: "status",
        text: "Error: Error on line 1\nError on line 2",
      })
    })

    it("should handle error messages with special characters", () => {
      const errorData = {
        message: 'Error with "quotes" and symbols: @#$%',
      }

      const result = formatter.formatError(errorData)

      expect(result).toEqual({
        type: "status",
        text: 'Error: Error with "quotes" and symbols: @#$%',
      })
    })
  })

  describe("message type classification", () => {
    it("should classify progress as status", () => {
      const result = formatter.formatProgress("Started: ClaudeCommand.run")
      expect(result.type).toBe("status")
    })

    it("should classify agent chunks as content", () => {
      const result = formatter.formatUpdate({
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "test" },
        },
      })
      expect(result?.type).toBe("content")
    })

    it("should classify tool calls as status", () => {
      const result = formatter.formatUpdate({
        update: {
          sessionUpdate: "tool_call",
          name: "test",
          title: "Test",
        },
      })
      expect(result?.type).toBe("status")
    })

    it("should classify errors as status", () => {
      const result = formatter.formatError({ message: "test" })
      expect(result.type).toBe("status")
    })
  })

  describe("edge cases and robustness", () => {
    it("should be reusable across multiple calls", () => {
      const result1 = formatter.formatProgress("Started: ClaudeCommand.run")
      const result2 = formatter.formatProgress("Completed: ClaudeCommand.run")
      const result3 = formatter.formatUpdate({
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "test" },
        },
      })

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(result3).toBeDefined()
    })

    it("should handle rapid consecutive calls", () => {
      const results = []

      for (let i = 0; i < 100; i++) {
        results.push(formatter.formatProgress(`Started: Command${i}.run`))
      }

      expect(results).toHaveLength(100)
      results.forEach((result) => {
        expect(result.type).toBe("status")
      })
    })

    it("should not mutate input data", () => {
      const input = {
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: "original",
          },
        },
      }

      const inputCopy = JSON.parse(JSON.stringify(input))
      formatter.formatUpdate(input)

      expect(input).toEqual(inputCopy)
    })
  })
})
