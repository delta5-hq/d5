import { expect } from '@playwright/test'
import { addArrayItem, cleanArrayIntegrations } from './helpers/array-integration-helpers'
import { startEchoHttpServer, type EchoHttpServer } from './helpers/echo-http-server-fixture'
import { ECHO_MCP_SERVER_PATH } from './helpers/stub-paths'
import { clearLLMProviderSettings } from './helpers/llm-integration-api'
import { createParallelUserTest } from './fixtures/parallel-user-test'
import {
  setupWorkflowWithCommandField,
  reloadAndGetExistingSetup,
  type WorkflowNodeSetupResult,
} from './helpers/workflow-node-setup'
import { createWorkflow, purgeUserWorkflows } from './utils'
import { TIMEOUTS } from './config/test-timeouts'
import { awaitNodeTitle } from './reliability/node-interaction'

const test = createParallelUserTest('reliability-external-dispatch-refusal')

// Echo-alias config builders — identical in shape to those in
// mcp-rpc-execution-flow.spec.ts (they are file-local, non-exported there), replicated
// here so this suite registers the same echo integrations a commodity :n=N would otherwise
// fan out over. A single dispatch of these aliases echoes the prompt back as one output node.
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

// Browser-proof of the external-dispatch fan-out refusal end-to-end. Owner note 14049 item 2
// retired the "side-effect" framing (the engine cannot know a side effect exists at all);
// register note 13982 then named the replacement under P0.360-SEG-b — containment "beyond
// collapse-to-one": the explicit replay/idempotency contract, or an outright refusal,
// "rather than silent collapse as the only protection". The landed contract is the refusal:
// a commodity :n=N (N>1) over an external dispatch (/mcp, /rpc, fusion) executes NOTHING,
// forks nothing, and surfaces the reason and the requested count on the cell.
test.describe('Reliability — external-dispatch fan-out refusal', () => {
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

  test('MCP alias with :n=3 is refused outright — no dispatch, one refusal node naming :n=3', async ({ page }) => {
    await addArrayItem(page, 'mcp', echoMcpStdioConfig('/e2e-guard-mcp'))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup

    await tree.selectNode(rootNodeId)
    await detail.waitForComponent()
    await detail.fillCommand('/e2e-guard-mcp :n=3 hello')
    await detail.execute()

    // The refusal lands as the ONLY child of the root: exactly one node, carrying the
    // refusal reason and the requested count. A silent collapse (the retired behaviour)
    // would have produced one echo output node titled "hello"; a broken N-fork would have
    // produced three. Neither is acceptable; exactly one refusal node is.
    const childNodes = tree.nodesAtDepth(1)
    await expect(childNodes).toHaveCount(1, { timeout: TIMEOUTS.BACKEND_SYNC })
    // The chip renders a truncated label, so assert on the node's canonical title attribute.
    await expect(childNodes.first()).toHaveAttribute('data-node-title', /:n=3/)
    await expect(childNodes.first()).toHaveAttribute('data-node-title', /external dispatch/i)

    // Nothing was dispatched: the echo tool's output ("hello") never appears anywhere.
    await expect(tree.nodeByTitle('hello')).toHaveCount(0)

    // The refused cell is marked invalid, never genuinely passed and never merely suppressed.
    await awaitNodeTitle(page, rootNodeId, /\[✗ !\]/)
  })

  test('RPC alias with :n=2 is refused outright — no dispatch, one refusal node naming :n=2', async ({ page }) => {
    await addArrayItem(page, 'rpc', echoHttpJsonConfig('/e2e-guard-rpc', echoHttpServer.url))
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup

    await tree.selectNode(rootNodeId)
    await detail.waitForComponent()
    await detail.fillCommand('/e2e-guard-rpc :n=2 hello')
    await detail.execute()

    const childNodes = tree.nodesAtDepth(1)
    await expect(childNodes).toHaveCount(1, { timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(childNodes.first()).toHaveAttribute('data-node-title', /:n=2/)
    await expect(childNodes.first()).toHaveAttribute('data-node-title', /external dispatch/i)

    await expect(tree.nodeByTitle('hello')).toHaveCount(0)
    await awaitNodeTitle(page, rootNodeId, /\[✗ !\]/)
  })
})
