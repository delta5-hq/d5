/**
 * Round-trip Integration Tests for runCommand
 *
 * Validates full execution chain: MongoDB → loadUserAliases → resolveCommand → runCommand → subprocess → output node
 *
 * Scope:
 * - MCP stdio transport with real subprocess spawning
 * - RPC HTTP transport with real network I/O
 * - RPC ACP-local transport with real agent protocol
 * - Multi-alias coexistence in single Integration doc
 * - Workflow-scoped overlay merging
 * - Edge cases: empty prompts, nonexistent aliases, encrypted fields, session hydration
 *
 * Out of scope:
 * - SSH transport (requires SSH server)
 * - Streamable HTTP / SSE MCP transports (requires HTTP MCP server)
 * - Agent mode (requires LLM API key)
 * - ExecutorController layer (tested separately)
 */

import {ReadableStream, WritableStream, TransformStream} from 'stream/web'
import {DatabaseFixtures} from './__tests__/fixtures/DatabaseFixtures'
import {TransportStubs} from './__tests__/fixtures/TransportStubs'
import {IntegrationDocBuilder} from './__tests__/fixtures/IntegrationDocBuilder'
import {RoundTripTestRunner} from './__tests__/RoundTripTestRunner'
import {OutputNodeValidator} from './__tests__/validators/OutputNodeValidator'
import {QueryTypeValidator} from './__tests__/validators/QueryTypeValidator'
import {resolveCommand} from './queryTypeResolver'

Object.assign(global, {ReadableStream, WritableStream, TransformStream})

const TEST_DB_URI = process.env.TEST_MONGO_URI
if (!TEST_DB_URI) {
  throw new Error('TEST_MONGO_URI env var is required (set by Makefile test-backend target)')
}
const TEST_USER_PREFIX = 'roundtrip-test-user-'

describe('runCommand round-trip integration', () => {
  let dbFixtures
  let transportStubs
  let testUserId

  beforeAll(async () => {
    dbFixtures = new DatabaseFixtures(TEST_DB_URI)
    transportStubs = new TransportStubs()

    await dbFixtures.connect()
    await transportStubs.startHttpServer()
  })

  afterAll(async () => {
    await transportStubs.cleanup()
    await dbFixtures.cleanup()
  })

  beforeEach(() => {
    testUserId = TEST_USER_PREFIX + Date.now()
  })

  describe('MCP stdio transport round-trip (3.0.4, 7.1.1)', () => {
    it('spawns echo-mcp-server via stdio, receives echoed text, creates output node', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/echo-mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'text',
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()
      const cell = runner.createCell({id: 'mcpNode', command: '/echo-mcp hello world'})

      const result = await runner.executeCell({cell, aliases})

      QueryTypeValidator.expectMcpQueryType(result, {aliasName: '/echo-mcp'})
      OutputNodeValidator.expectNodeWithTitle(result.output, {
        title: 'hello world',
        parentId: 'mcpNode',
      })
    }, 30000)
  })

  describe('RPC HTTP transport round-trip (3.2.3, 7.1.2)', () => {
    it('hits echo-http-server, parses JSON response, creates output node', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addRpcHttp({
          alias: '/echo-http',
          url: `${transportStubs.getHttpServerUrl()}/execute`,
          bodyTemplate: '{{prompt}}',
          outputFormat: 'json',
          outputField: 'echoed',
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()
      const cell = runner.createCell({id: 'httpNode', command: '/echo-http test payload'})

      const result = await runner.executeCell({cell, aliases})

      QueryTypeValidator.expectRpcQueryType(result, {aliasName: '/echo-http'})
      OutputNodeValidator.expectNodeWithTitle(result.output, {
        title: 'test payload',
        parentId: 'httpNode',
      })
    }, 15000)
  })

  describe('RPC ACP-local transport round-trip (3.1.2, 7.1.3)', () => {
    it('spawns echo-acp-server via ACP protocol, aggregates sessionUpdate, creates output node', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addRpcAcp({
          alias: '/echo-acp',
          command: 'node',
          args: [transportStubs.getAcpLocalPath()],
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()
      const cell = runner.createCell({id: 'acpNode', command: '/echo-acp agent prompt'})

      const result = await runner.executeCell({cell, aliases})

      QueryTypeValidator.expectRpcQueryType(result, {aliasName: '/echo-acp'})
      OutputNodeValidator.expectNodeTitleContains(result.output, {
        substring: 'Echo: agent prompt',
        parentId: 'acpNode',
      })
    }, 30000)
  })

  describe('Multi-alias coexistence (3.3.7, 7.1.4)', () => {
    it('executes three aliases from single Integration doc sequentially', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/echo-mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'text',
        })
        .addRpcHttp({
          alias: '/echo-http',
          url: `${transportStubs.getHttpServerUrl()}/execute`,
          bodyTemplate: '{{prompt}}',
          outputFormat: 'json',
          outputField: 'echoed',
        })
        .addRpcAcp({
          alias: '/echo-acp',
          command: 'node',
          args: [transportStubs.getAcpLocalPath()],
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()

      const cells = [
        runner.createCell({id: 'mcp1', command: '/echo-mcp first'}),
        runner.createCell({id: 'http1', command: '/echo-http second'}),
        runner.createCell({id: 'acp1', command: '/echo-acp third'}),
      ]

      const {output} = await runner.executeMultipleCells({cells, aliases})

      OutputNodeValidator.expectNodeCount(output, 3)
      OutputNodeValidator.expectAllParentsMatch(output, ['mcp1', 'http1', 'acp1'])
    }, 45000)
  })

  describe('Workflow-scoped overlay (3.3.8, 7.1.5)', () => {
    it('merges workflow-scoped Integration over global, workflow override wins', async () => {
      const workflowId = 'wf-overlay-test'

      const globalDoc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/echo-mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'wrong_field',
        })
        .build()

      const workflowDoc = new IntegrationDocBuilder(testUserId, workflowId)
        .addMcpStdio({
          alias: '/echo-mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'text',
        })
        .build()

      await dbFixtures.insertIntegration(globalDoc)
      await dbFixtures.insertIntegration(workflowDoc)

      const runnerGlobal = new RoundTripTestRunner(testUserId)
      const aliasesGlobal = await runnerGlobal.loadAliases()
      expect(aliasesGlobal.mcp[0].toolInputField).toBe('wrong_field')

      const runnerWorkflow = new RoundTripTestRunner(testUserId, workflowId)
      const aliasesWorkflow = await runnerWorkflow.loadAliases()
      expect(aliasesWorkflow.mcp[0].toolInputField).toBe('text')

      const cell = runnerWorkflow.createCell({id: 'overlay', command: '/echo-mcp merged'})
      const result = await runnerWorkflow.executeCell({cell, aliases: aliasesWorkflow})

      OutputNodeValidator.expectNodeWithTitle(result.output, {
        title: 'merged',
        parentId: 'overlay',
      })
    }, 30000)

    it('global without overlay uses wrong_field, produces empty response', async () => {
      const globalDoc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/echo-mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'wrong_field',
        })
        .build()

      await dbFixtures.insertIntegration(globalDoc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()
      const cell = runner.createCell({id: 'global', command: '/echo-mcp test'})

      const result = await runner.executeCell({cell, aliases})

      OutputNodeValidator.expectNodeWithTitle(result.output, {
        title: '(empty MCP response)',
        parentId: 'global',
      })
    }, 30000)
  })

  describe('Edge case: empty prompt (7.1.6)', () => {
    it('alias with no prompt text produces (empty MCP response)', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/echo-mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'text',
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()
      const cell = runner.createCell({id: 'empty', command: '/echo-mcp'})

      const result = await runner.executeCell({cell, aliases})

      OutputNodeValidator.expectNodeWithTitle(result.output, {
        title: '(empty MCP response)',
        parentId: 'empty',
      })
    }, 30000)
  })

  describe('Edge case: nonexistent alias (7.1.7)', () => {
    it('resolveCommand returns undefined for unmatched alias', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/valid',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'text',
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()

      const result = resolveCommand('/nonexistent hello', aliases)

      QueryTypeValidator.expectNoMatch(result)
    })
  })

  describe('Edge case: encrypted env field round-trip', () => {
    it('encrypts env field on insert, decrypts on loadUserAliases', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/echo-mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'text',
          env: {SECRET_VAR: 'encrypted-value'},
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()

      expect(aliases.mcp[0].env).toEqual({SECRET_VAR: 'encrypted-value'})
    })
  })

  describe('Edge case: session hydration', () => {
    it('SessionHydrator loads lastSessionId from IntegrationSession collection', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addRpcHttp({
          alias: '/api-with-session',
          url: `${transportStubs.getHttpServerUrl()}/execute`,
          bodyTemplate: '{{prompt}}',
          outputFormat: 'json',
          outputField: 'echoed',
        })
        .build()

      await dbFixtures.insertIntegration(doc)
      await dbFixtures.insertSession({
        userId: testUserId,
        alias: '/api-with-session',
        protocol: 'rpc',
        lastSessionId: 'prev-session-123',
      })

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()

      expect(aliases.rpc[0].lastSessionId).toBe('prev-session-123')
    })
  })

  describe('Multi-node workflow regression (8.1)', () => {
    it('executes three different transport types in single workflow tree', async () => {
      const doc = new IntegrationDocBuilder(testUserId)
        .addMcpStdio({
          alias: '/mcp',
          command: 'node',
          args: [transportStubs.getMcpStdioPath()],
          toolName: 'echo',
          toolInputField: 'text',
        })
        .addRpcHttp({
          alias: '/http',
          url: `${transportStubs.getHttpServerUrl()}/execute`,
          bodyTemplate: '{{prompt}}',
          outputFormat: 'json',
          outputField: 'echoed',
        })
        .addRpcAcp({
          alias: '/acp',
          command: 'node',
          args: [transportStubs.getAcpLocalPath()],
        })
        .build()

      await dbFixtures.insertIntegration(doc)

      const runner = new RoundTripTestRunner(testUserId)
      const aliases = await runner.loadAliases()

      const cells = [
        runner.createCell({id: 'node1', command: '/mcp regression1'}),
        runner.createCell({id: 'node2', command: '/http regression2'}),
        runner.createCell({id: 'node3', command: '/acp regression3'}),
      ]

      const {output} = await runner.executeMultipleCells({cells, aliases})

      OutputNodeValidator.expectNodeCount(output, 3)
      OutputNodeValidator.expectNodeWithTitle(output, {title: 'regression1', parentId: 'node1'})
      OutputNodeValidator.expectNodeWithTitle(output, {title: 'regression2', parentId: 'node2'})
      OutputNodeValidator.expectNodeTitleContains(output, {
        substring: 'Echo: regression3',
        parentId: 'node3',
      })
    }, 60000)
  })
})
