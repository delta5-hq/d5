import { expect } from '@playwright/test'
import { addArrayItem, cleanArrayIntegrations } from './helpers/array-integration-helpers'
import { startEchoHttpServer, type EchoHttpServer } from './helpers/echo-http-server-fixture'
import { ECHO_MCP_SERVER_PATH } from './helpers/stub-paths'
import { executeCommandAndAwaitOutput } from './helpers/execute-command-flow'
import { clearLLMProviderSettings } from './helpers/llm-integration-api'
import { createParallelUserTest } from './fixtures/parallel-user-test'
import {
  setupWorkflowWithCommandField,
  reloadAndGetExistingSetup,
  type WorkflowNodeSetupResult,
} from './helpers/workflow-node-setup'
import { createWorkflow, purgeUserWorkflows } from './utils'
import { TIMEOUTS } from './config/test-timeouts'

const test = createParallelUserTest('reliability-side-effect-guard')

// Echo-alias config builders — identical in shape to those in
// mcp-rpc-execution-flow.spec.ts (they are file-local, non-exported there), replicated
// here so this suite registers the same echo integrations the side-effecting-:n guard
// fires on. A single dispatch of these aliases echoes the prompt back as one output node.
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

// Browser-proof of the side-effecting-:n guard end-to-end: a commodity :n=N on a
// side-effecting MCP/RPC alias must execute the external op EXACTLY ONCE (not N times)
// and surface a visible, honest suppression hint (never a silent collapse).
test.describe('Reliability — side-effecting :n guard', () => {
  test.describe.configure({ mode: 'serial' })

  let echoHttpServer: EchoHttpServer
  let setup: WorkflowNodeSetupResult

  test.beforeAll(async () => {
    echoHttpServer = await startEchoHttpServer()
  })

  test.afterAll(async () => {
    await echoHttpServer.stop()
  })

  // Mirrors mcp-rpc-execution-flow.spec.ts's auth/session/workflow setup: a fresh
  // workflow with a single selected root cell whose command field is ready to fill.
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

  test('MCP alias with :n=3 executes the external op once and surfaces the suppression hint', async ({ page }) => {
    await addArrayItem(page, 'mcp', echoMcpStdioConfig('/e2e-guard-mcp'))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup

    // Run the side-effecting alias with a best-of-3 request. The guard forces a single
    // dispatch, so the echo tool runs ONCE and emits exactly one echoed output node.
    // executeCommandAndAwaitOutput selects the root, fills, executes, and waits for the
    // echoed child ("hello") to appear — the same UI flow mcp-rpc-execution-flow uses.
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-guard-mcp :n=3 hello', 'hello')

    // "Exactly one output node": the root sits at depth 0 and its output children at
    // depth 1. A working guard yields exactly one depth-1 node; a broken one (N-fork)
    // would yield 3. Cross-checked by exactly one root node at depth 0.
    await expect(tree.nodesAtDepth(0)).toHaveCount(1)
    await expect(tree.nodesAtDepth(1)).toHaveCount(1)

    // "Hint visible + references N": the executed root cell now carries
    // reliabilityMetadata.mode === 'suppressed'. Re-select it to bind the freshest node
    // data, then assert the hint element is visible and references the requested N via
    // the locale-neutral ":n=3" token (present verbatim in both EN and RU translations,
    // so this asserts on the number token, not English prose).
    await tree.selectNode(rootNodeId)
    await detail.waitForComponent()
    const hint = page.getByTestId('suppressed-run-hint')
    await expect(hint).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(hint).toContainText(':n=3')
  })

  test('RPC alias with :n=2 executes the external op once and surfaces the suppression hint', async ({ page }) => {
    await addArrayItem(page, 'rpc', echoHttpJsonConfig('/e2e-guard-rpc', echoHttpServer.url))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup

    // Same guard, RPC dispatch path, best-of-2 request → single HTTP call, one output node.
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-guard-rpc :n=2 hello', 'hello')

    await expect(tree.nodesAtDepth(0)).toHaveCount(1)
    await expect(tree.nodesAtDepth(1)).toHaveCount(1)

    await tree.selectNode(rootNodeId)
    await detail.waitForComponent()
    const hint = page.getByTestId('suppressed-run-hint')
    await expect(hint).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(hint).toContainText(':n=2')
  })
})
