/**
 * MCPClientManager Integration Tests
 *
 * Tests real subprocess spawning and MCP protocol communication using echo-mcp-server stub.
 * Complements MCPClientManager.test.js (mocked SDK) by proving transport layer works.
 *
 * Scope:
 * - Subprocess lifecycle (spawn, connect, close)
 * - Protocol handshake over real stdio pipes
 * - Data integrity across process boundaries
 * - Error propagation from external processes
 * - Concurrent subprocess management
 *
 * Out of scope (covered by unit tests):
 * - Transport parameter validation
 * - Timeout configuration
 * - Result formatting edge cases
 * - Transport type switching
 */

import path from 'path'
import {callTool, listTools} from './MCPClientManager'
import {MCP_TRANSPORT} from '../../constants/mcp'

const ECHO_SERVER_PATH = path.resolve(__dirname, '../../../../test-stubs/echo-mcp-server.cjs')

describe('MCPClientManager integration', () => {
  describe('stdio subprocess lifecycle', () => {
    it('completes full lifecycle: spawn → initialize → callTool → close', async () => {
      const result = await callTool({
        transport: MCP_TRANSPORT.STDIO,
        command: 'node',
        args: [ECHO_SERVER_PATH],
        toolName: 'echo',
        toolArguments: {text: 'lifecycle-test'},
        timeoutMs: 10000,
      })

      expect(result.isError).toBe(false)
      expect(result.content).toBe('lifecycle-test')
    }, 15000)

    it('rejects when subprocess binary does not exist', async () => {
      await expect(
        callTool({
          transport: MCP_TRANSPORT.STDIO,
          command: 'nonexistent_binary_12345',
          args: [],
          toolName: 'echo',
          toolArguments: {text: 'test'},
          timeoutMs: 10000,
        }),
      ).rejects.toThrow()
    }, 15000)
  })

  describe('stdio data integrity across process boundaries', () => {
    it.each([
      ['simple text', 'hello world'],
      ['empty string', ''],
      ['unicode characters', '日本語テスト 🎉 Émojis Ñoño'],
      ['special characters', '<>&"\'\n\t'],
      ['JSON-like content', '{"key": "value", "num": 123}'],
      ['newline sequences', 'line1\nline2\r\nline3'],
      ['null bytes would be stripped', 'before\x00after'],
    ])(
      'preserves %s through stdio JSON-RPC serialization',
      async (_label, text) => {
        const result = await callTool({
          transport: MCP_TRANSPORT.STDIO,
          command: 'node',
          args: [ECHO_SERVER_PATH],
          toolName: 'echo',
          toolArguments: {text},
          timeoutMs: 10000,
        })

        expect(result.isError).toBe(false)
        expect(result.content).toBe(text)
      },
      15000,
    )

    it.each([
      [1000, 'kilobyte-scale'],
      [10000, 'ten-kilobyte-scale'],
      [50000, 'fifty-kilobyte-scale'],
    ])(
      'handles %d character payload (%s) without truncation or buffering issues',
      async size => {
        const largeText = 'x'.repeat(size)

        const result = await callTool({
          transport: MCP_TRANSPORT.STDIO,
          command: 'node',
          args: [ECHO_SERVER_PATH],
          toolName: 'echo',
          toolArguments: {text: largeText},
          timeoutMs: 10000,
        })

        expect(result.isError).toBe(false)
        expect(result.content).toBe(largeText)
        expect(result.content.length).toBe(size)
      },
      30000,
    )
  })

  describe('MCP protocol error propagation', () => {
    it('propagates tool-not-found errors from subprocess with isError=true', async () => {
      const result = await callTool({
        transport: MCP_TRANSPORT.STDIO,
        command: 'node',
        args: [ECHO_SERVER_PATH],
        toolName: 'nonexistent_tool',
        toolArguments: {},
        timeoutMs: 10000,
      })

      expect(result.isError).toBe(true)
      expect(result.content).toBeTruthy()
      expect(result.content.toLowerCase()).toMatch(/not found|unknown/i)
    }, 15000)

    it('maintains {isError, content} structure for all error responses', async () => {
      const result = await callTool({
        transport: MCP_TRANSPORT.STDIO,
        command: 'node',
        args: [ECHO_SERVER_PATH],
        toolName: 'invalid_tool_name',
        toolArguments: {},
        timeoutMs: 10000,
      })

      expect(result).toMatchObject({
        isError: expect.any(Boolean),
        content: expect.any(String),
      })
      expect(result.isError).toBe(true)
    }, 15000)
  })

  describe('MCP tools/list protocol operation', () => {
    it('retrieves complete tool metadata from subprocess', async () => {
      const tools = await listTools({
        transport: MCP_TRANSPORT.STDIO,
        command: 'node',
        args: [ECHO_SERVER_PATH],
      })

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)

      const echoTool = tools.find(t => t.name === 'echo')
      expect(echoTool).toMatchObject({
        name: 'echo',
        description: expect.any(String),
        inputSchema: expect.any(Object),
      })
    }, 15000)

    it('validates tool descriptor structure for all returned tools', async () => {
      const tools = await listTools({
        transport: MCP_TRANSPORT.STDIO,
        command: 'node',
        args: [ECHO_SERVER_PATH],
      })

      tools.forEach(tool => {
        expect(tool.name).toMatch(/^[a-z_][a-z0-9_]*$/)
        expect(tool).toHaveProperty('inputSchema')
        expect(typeof tool.inputSchema).toBe('object')
      })
    }, 15000)
  })

  describe('subprocess concurrency and isolation', () => {
    it('maintains state isolation across sequential calls to independent subprocesses', async () => {
      const inputs = ['call-A', 'call-B', 'call-C']
      const results = []

      for (const text of inputs) {
        const result = await callTool({
          transport: MCP_TRANSPORT.STDIO,
          command: 'node',
          args: [ECHO_SERVER_PATH],
          toolName: 'echo',
          toolArguments: {text},
          timeoutMs: 10000,
        })
        results.push(result)
      }

      expect(results).toHaveLength(3)
      results.forEach((result, i) => {
        expect(result.isError).toBe(false)
        expect(result.content).toBe(inputs[i])
      })
    }, 45000)

    it('supports concurrent callTool operations with independent subprocess instances', async () => {
      const promises = Array.from({length: 3}, (_, i) =>
        callTool({
          transport: MCP_TRANSPORT.STDIO,
          command: 'node',
          args: [ECHO_SERVER_PATH],
          toolName: 'echo',
          toolArguments: {text: `concurrent-${i}`},
          timeoutMs: 10000,
        }),
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach((result, i) => {
        expect(result.isError).toBe(false)
        expect(result.content).toBe(`concurrent-${i}`)
      })
    }, 30000)
  })
})
