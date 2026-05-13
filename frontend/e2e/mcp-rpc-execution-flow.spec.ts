import { expect } from '@playwright/test'
import { addArrayItem, cleanArrayIntegrations, deleteArrayItem } from './helpers/array-integration-helpers'
import { startEchoHttpServer, type EchoHttpServer } from './helpers/echo-http-server-fixture'
import { ECHO_ACP_SERVER_PATH, ECHO_MCP_SERVER_PATH } from './helpers/stub-paths'
import { executeCommandAndAwaitOutput } from './helpers/execute-command-flow'
import { saveLLMProviderSettings, clearLLMProviderSettings } from './helpers/llm-integration-api'
import { createParallelUserTest } from './fixtures/parallel-user-test'
import {
  setupWorkflowWithCommandField,
  reloadAndGetExistingSetup,
  type WorkflowNodeSetupResult,
} from './helpers/workflow-node-setup'
import { createWorkflow, purgeUserWorkflows } from './utils'
import { TIMEOUTS } from './config/test-timeouts'

const test = createParallelUserTest('mcp-rpc-exec')

const CLAUDE_MOCK_RESPONSE = 'Mock response from Claude'

const NOOP_CLAUDE_SETTINGS = {
  apiKey: 'e2e-test-noop-key',
  model: 'claude-3-5-sonnet-20241022',
}

const echoMcpStdioConfig = (alias: string) => ({
  alias,
  transport: 'stdio',
  command: 'node',
  args: [ECHO_MCP_SERVER_PATH],
  toolName: 'echo',
  toolInputField: 'text',
})

const echoHttpJsonConfig = (alias: string, url: string) => ({
  alias,
  protocol: 'http',
  url,
  method: 'POST',
  bodyTemplate: '{{prompt}}',
  outputFormat: 'json',
  outputField: 'echoed',
})

const echoHttpTextConfig = (alias: string, url: string) => ({
  alias,
  protocol: 'http',
  url,
  method: 'POST',
  bodyTemplate: '{{prompt}}',
  outputFormat: 'text',
})

const echoAcpLocalConfig = (alias: string) => ({
  alias,
  protocol: 'acp-local',
  command: 'node',
  args: [ECHO_ACP_SERVER_PATH],
  workingDir: '/tmp',
  autoApprove: 'all',
})

test.describe('MCP / RPC Execution Flow', () => {
  test.describe.configure({ mode: 'serial' })

  let echoHttpServer: EchoHttpServer
  let setup: WorkflowNodeSetupResult

  test.beforeAll(async () => {
    echoHttpServer = await startEchoHttpServer()
  })

  test.afterAll(async () => {
    await echoHttpServer.stop()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    await purgeUserWorkflows(page)
    await cleanArrayIntegrations(page)
    await clearLLMProviderSettings(page, 'claude')
    await createWorkflow(page)
    await page.waitForLoadState('networkidle')
    setup = await setupWorkflowWithCommandField(page)
  })

  test.afterEach(async ({ page }) => {
    await cleanArrayIntegrations(page)
    await clearLLMProviderSettings(page, 'claude')
  })

  test('MCP stdio integration executes command via alias and produces output node with echoed content', async ({
    page,
  }) => {
    await addArrayItem(page, 'mcp', echoMcpStdioConfig('/e2e-mcp'))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-mcp hello', 'hello')
  })

  test('MCP stdio alias produces one output node per paragraph in multi-paragraph response', async ({ page }) => {
    await addArrayItem(page, 'mcp', echoMcpStdioConfig('/e2e-mcp-multi'))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(
      tree,
      detail,
      rootNodeId,
      '/e2e-mcp-multi first paragraph\n\nsecond paragraph',
      'first paragraph',
    )
    await expect(tree.nodeByTitle('second paragraph')).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
  })

  test('MCP stdio alias with empty prompt produces placeholder output node', async ({ page }) => {
    await addArrayItem(page, 'mcp', echoMcpStdioConfig('/e2e-empty'))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-empty', '(empty MCP response)')
  })

  test('RPC HTTP integration extracts JSON response field into output node', async ({ page }) => {
    await addArrayItem(page, 'rpc', echoHttpJsonConfig('/e2e-http-json', echoHttpServer.url))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-http-json hello', 'hello')
  })

  test('RPC HTTP integration with text output format captures raw response body as output node', async ({ page }) => {
    await addArrayItem(page, 'rpc', echoHttpTextConfig('/e2e-http-text', echoHttpServer.url))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-http-text hello', 'echoed')
  })

  test('RPC ACP-local integration executes command and produces output node with echoed content', async ({ page }) => {
    await addArrayItem(page, 'rpc', echoAcpLocalConfig('/e2e-acp'))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-acp hello', 'Echo: hello', TIMEOUTS.BACKEND_SYNC)
  })

  test('configured LLM provider key enables command execution and produces output node', async ({ page }) => {
    await saveLLMProviderSettings(page, 'claude', NOOP_CLAUDE_SETTINGS)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/claude hello', CLAUDE_MOCK_RESPONSE)
  })

  test('unconfigured LLM provider produces error node instead of silent empty response', async () => {
    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(
      tree,
      detail,
      rootNodeId,
      '/claude hello',
      'Error: Claude API key not configured',
    )
  })

  test('executing an alias that was never registered produces an error node', async () => {
    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(
      tree,
      detail,
      rootNodeId,
      '/e2e-never-existed hello',
      'Error: Unknown command "/e2e-never-existed"',
    )
  })

  test('executing deleted integration alias produces error node', async ({ page }) => {
    await addArrayItem(page, 'rpc', echoHttpJsonConfig('/e2e-deleted', echoHttpServer.url))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-deleted hello', 'hello')

    await deleteArrayItem(page, 'rpc', '/e2e-deleted')
    setup = await reloadAndGetExistingSetup(page)

    await executeCommandAndAwaitOutput(
      setup.tree,
      setup.detail,
      setup.rootNodeId,
      '/e2e-deleted hello',
      'Error: Unknown command "/e2e-deleted"',
    )
  })
})
