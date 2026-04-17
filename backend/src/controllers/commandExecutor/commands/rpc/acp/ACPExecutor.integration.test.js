/**
 * ACPExecutor Integration Tests
 *
 * Tests real subprocess spawning and ACP protocol communication using echo-acp-server stub.
 * Complements ACPExecutor.test.js (mocked connections) by proving transport layer works.
 *
 * Scope:
 * - Subprocess lifecycle (spawn, initialize, newSession, prompt, close)
 * - Protocol handshake over real stdio pipes (ndjson)
 * - Session ID management across process boundaries
 * - Data integrity for prompt/response round-trips
 * - Timeout and abort signal enforcement
 *
 * Out of scope (covered by unit tests):
 * - Permission policy logic
 * - Response aggregator text/tool extraction
 * - Parameter validation
 * - Error message formatting
 */

import path from 'path'
import {ReadableStream, WritableStream, TransformStream} from 'stream/web'
import {ACPExecutor} from './ACPExecutor'

Object.assign(global, {ReadableStream, WritableStream, TransformStream})

const ECHO_SERVER_PATH = path.resolve(__dirname, '../../../../../test-stubs/echo-acp-server.cjs')

describe('ACPExecutor integration', () => {
  describe('ACP protocol lifecycle over stdio', () => {
    it('completes full lifecycle: spawn → initialize → newSession → prompt → close', async () => {
      const executor = new ACPExecutor()

      const result = await executor.execute({
        command: 'node',
        args: [ECHO_SERVER_PATH],
        prompt: 'lifecycle-test',
        timeoutMs: 10000,
      })

      expect(result).toMatchObject({
        output: expect.any(String),
        sessionId: expect.stringMatching(/^echo-session-/),
        exitCode: 0,
        stopReason: 'end_turn',
      })
    }, 15000)
  })

  describe('ndjson data integrity across process boundaries', () => {
    it.each([
      ['simple text', 'hello world'],
      ['empty string', ''],
      ['unicode characters', '日本語テスト 🎉 Émojis'],
      ['special characters', '<>&"\'\n\t'],
      ['JSON-like content', '{"key": "value"}'],
    ])(
      'preserves %s through ndjson prompt/sessionUpdate serialization',
      async (_label, prompt) => {
        const executor = new ACPExecutor()

        const result = await executor.execute({
          command: 'node',
          args: [ECHO_SERVER_PATH],
          prompt,
          timeoutMs: 10000,
        })

        expect(result.exitCode).toBe(0)
        expect(result.output).toBe(`Echo: ${prompt}`)
        expect(result.stopReason).toBe('end_turn')
      },
      15000,
    )

    it('handles large prompt payloads (10KB) without truncation or buffering issues', async () => {
      const executor = new ACPExecutor()
      const largePrompt = 'x'.repeat(10000)

      const result = await executor.execute({
        command: 'node',
        args: [ECHO_SERVER_PATH],
        prompt: largePrompt,
        timeoutMs: 10000,
      })

      expect(result.exitCode).toBe(0)
      expect(result.output).toBe(`Echo: ${largePrompt}`)
      expect(result.output.length).toBe(largePrompt.length + 6)
    }, 15000)
  })

  describe('ACP session ID management', () => {
    it('generates unique session IDs for independent subprocess executions', async () => {
      const executor = new ACPExecutor()
      const sessionIds = new Set()

      for (let i = 0; i < 3; i++) {
        const result = await executor.execute({
          command: 'node',
          args: [ECHO_SERVER_PATH],
          prompt: `test-${i}`,
          timeoutMs: 10000,
        })
        sessionIds.add(result.sessionId)
      }

      expect(sessionIds.size).toBe(3)
    }, 45000)

    it('returns agent-generated session ID in result structure', async () => {
      const executor = new ACPExecutor()

      const result = await executor.execute({
        command: 'node',
        args: [ECHO_SERVER_PATH],
        prompt: 'session-id-test',
        timeoutMs: 10000,
      })

      expect(result.sessionId).toMatch(/^echo-session-\d+-[a-z0-9]+$/)
    }, 15000)
  })

  describe('timeout enforcement at subprocess level', () => {
    it('rejects when prompt execution exceeds configured timeoutMs', async () => {
      const executor = new ACPExecutor()

      await expect(
        executor.execute({
          command: 'node',
          args: [
            '-e',
            `
            const {AgentSideConnection, ndJsonStream, PROTOCOL_VERSION} = require('@agentclientprotocol/sdk');
            const {Writable, Readable} = require('stream');
            const output = Writable.toWeb(process.stdout);
            const input = Readable.toWeb(process.stdin);
            const stream = ndJsonStream(output, input);
            const agent = {
              async initialize() { return {protocolVersion: PROTOCOL_VERSION, agentCapabilities: {}, agentInfo: {name:'slow',version:'1.0.0'}}; },
              async newSession() { return {sessionId: 's1'}; },
              async prompt() { await new Promise(resolve => setTimeout(resolve, 10000)); return {stopReason: 'end_turn'}; }
            };
            new AgentSideConnection(() => agent, stream);
          `,
          ],
          prompt: 'slow-agent-test',
          timeoutMs: 1000,
        }),
      ).rejects.toThrow(/timeout/i)
    }, 5000)
  })

  describe('abort signal propagation to subprocess', () => {
    it('terminates subprocess when signal fires during prompt execution', async () => {
      const executor = new ACPExecutor()
      const abortController = new AbortController()

      setTimeout(() => abortController.abort(), 500)

      await expect(
        executor.execute({
          command: 'node',
          args: [
            '-e',
            `
            const {AgentSideConnection, ndJsonStream, PROTOCOL_VERSION} = require('@agentclientprotocol/sdk');
            const {Writable, Readable} = require('stream');
            const output = Writable.toWeb(process.stdout);
            const input = Readable.toWeb(process.stdin);
            const stream = ndJsonStream(output, input);
            const agent = {
              async initialize() { return {protocolVersion: PROTOCOL_VERSION, agentCapabilities: {}, agentInfo: {name:'long',version:'1.0.0'}}; },
              async newSession() { return {sessionId: 's1'}; },
              async prompt() { await new Promise(resolve => setTimeout(resolve, 10000)); return {stopReason: 'end_turn'}; },
              async cancel() {}
            };
            new AgentSideConnection(() => agent, stream);
          `,
          ],
          prompt: 'abortable-agent-test',
          timeoutMs: 15000,
          signal: abortController.signal,
        }),
      ).rejects.toThrow(/abort/i)
    }, 5000)
  })

  describe('error condition handling', () => {
    it('validates required command parameter before subprocess spawn', async () => {
      const executor = new ACPExecutor()

      await expect(
        executor.execute({
          command: '',
          args: [],
          prompt: 'validation-test',
          timeoutMs: 10000,
        }),
      ).rejects.toThrow(/command is required/i)
    })

    it('rejects immediately when abort signal is already aborted', async () => {
      const executor = new ACPExecutor()
      const abortController = new AbortController()
      abortController.abort()

      await expect(
        executor.execute({
          command: 'node',
          args: [ECHO_SERVER_PATH],
          prompt: 'pre-aborted-test',
          timeoutMs: 10000,
          signal: abortController.signal,
        }),
      ).rejects.toThrow(/abort/i)
    })
  })
})
