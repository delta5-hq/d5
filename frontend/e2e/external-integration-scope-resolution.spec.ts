import {
  addMCPItemAtScope,
  addRPCItemAtScope,
  cleanAllIntegrationsAcrossScopes,
  deleteMCPItemAtScope,
  deleteRPCItemAtScope,
} from './helpers/workflow-scoped-cleanup'
import { startEchoHttpServer, type EchoHttpServer } from './helpers/echo-http-server-fixture'
import { ECHO_MCP_SERVER_PATH } from './helpers/stub-paths'
import { executeCommandAndAwaitOutput } from './helpers/execute-command-flow'
import { createParallelUserTest } from './fixtures/parallel-user-test'
import {
  setupWorkflowWithCommandField,
  reloadAndGetExistingSetup,
  type WorkflowNodeSetupResult,
} from './helpers/workflow-node-setup'
import { createWorkflow, purgeUserWorkflows } from './utils'
import { TIMEOUTS } from './config/test-timeouts'

const test = createParallelUserTest('ext-scope')

const workingMcpConfig = (alias: string) => ({
  alias,
  transport: 'stdio',
  command: 'node',
  args: [ECHO_MCP_SERVER_PATH],
  toolName: 'echo',
  toolInputField: 'text',
})

const brokenMcpConfig = (alias: string) => ({
  alias,
  transport: 'stdio',
  command: 'does-not-exist-binary',
  args: [],
  toolName: 'echo',
  toolInputField: 'text',
})

const workingRpcConfig = (alias: string, url: string) => ({
  alias,
  protocol: 'http',
  url,
  method: 'POST',
  bodyTemplate: '{{prompt}}',
  outputFormat: 'json',
  outputField: 'echoed',
})

const unreachableRpcConfig = (alias: string) => ({
  alias,
  protocol: 'http',
  url: 'http://127.0.0.1:1',
  method: 'POST',
  bodyTemplate: '{{prompt}}',
  outputFormat: 'json',
  outputField: 'echoed',
})

test.describe('Workflow-scope alias resolution at execute time', () => {
  test.describe.configure({ mode: 'serial' })

  let echoHttpServer: EchoHttpServer
  let workflowId: string
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
    await cleanAllIntegrationsAcrossScopes(page, [{ label: 'user', workflowId: undefined }])
    workflowId = await createWorkflow(page)
    await page.waitForLoadState('networkidle')
    setup = await setupWorkflowWithCommandField(page)
  })

  test.afterEach(async ({ page }) => {
    await cleanAllIntegrationsAcrossScopes(page, [
      { label: 'user', workflowId: undefined },
      { label: 'workflow', workflowId },
    ])
  })

  test('MCP workflow-scope alias resolves and executes when no user-scope counterpart exists', async ({ page }) => {
    await addMCPItemAtScope(page, workingMcpConfig('/e2e-wf-mcp-only'), workflowId)
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-wf-mcp-only hello', 'hello')
  })

  test('MCP workflow-scope alias is used instead of user-scope alias with same name at execute time', async ({
    page,
  }) => {
    await addMCPItemAtScope(page, brokenMcpConfig('/e2e-wf-mcp-override'))
    await addMCPItemAtScope(page, workingMcpConfig('/e2e-wf-mcp-override'), workflowId)
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(
      tree,
      detail,
      rootNodeId,
      '/e2e-wf-mcp-override hello',
      'hello',
      TIMEOUTS.BACKEND_SYNC,
    )
  })

  test('MCP user-scope alias becomes active as fallback after workflow-scope alias is deleted', async ({ page }) => {
    await addMCPItemAtScope(page, workingMcpConfig('/e2e-wf-mcp-fallback'))
    await addMCPItemAtScope(page, brokenMcpConfig('/e2e-wf-mcp-fallback'), workflowId)
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-wf-mcp-fallback hello', 'Error:')

    await deleteMCPItemAtScope(page, '/e2e-wf-mcp-fallback', workflowId)
    setup = await reloadAndGetExistingSetup(page)

    await executeCommandAndAwaitOutput(
      setup.tree,
      setup.detail,
      setup.rootNodeId,
      '/e2e-wf-mcp-fallback hello',
      'hello',
    )
  })

  test('RPC workflow-scope alias resolves and executes when no user-scope counterpart exists', async ({ page }) => {
    await addRPCItemAtScope(page, workingRpcConfig('/e2e-wf-rpc-only', echoHttpServer.url), workflowId)
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-wf-rpc-only hello', 'hello')
  })

  test('RPC workflow-scope alias is used instead of user-scope alias with same name at execute time', async ({
    page,
  }) => {
    await addRPCItemAtScope(page, unreachableRpcConfig('/e2e-wf-rpc-override'))
    await addRPCItemAtScope(page, workingRpcConfig('/e2e-wf-rpc-override', echoHttpServer.url), workflowId)
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(
      tree,
      detail,
      rootNodeId,
      '/e2e-wf-rpc-override hello',
      'hello',
      TIMEOUTS.BACKEND_SYNC,
    )
  })

  test('RPC user-scope alias becomes active as fallback after workflow-scope alias is deleted', async ({ page }) => {
    await addRPCItemAtScope(page, workingRpcConfig('/e2e-wf-rpc-fallback', echoHttpServer.url))
    await addRPCItemAtScope(page, unreachableRpcConfig('/e2e-wf-rpc-fallback'), workflowId)
    setup = await reloadAndGetExistingSetup(page)

    const { rootNodeId, tree, detail } = setup
    await executeCommandAndAwaitOutput(tree, detail, rootNodeId, '/e2e-wf-rpc-fallback hello', 'Error:')

    await deleteRPCItemAtScope(page, '/e2e-wf-rpc-fallback', workflowId)
    setup = await reloadAndGetExistingSetup(page)

    await executeCommandAndAwaitOutput(
      setup.tree,
      setup.detail,
      setup.rootNodeId,
      '/e2e-wf-rpc-fallback hello',
      'hello',
    )
  })
})
