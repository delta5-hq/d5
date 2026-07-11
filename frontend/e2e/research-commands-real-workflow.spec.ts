import { expect, type Page } from '@playwright/test'
import { createAdminTest } from './fixtures/parallel-user-test'
import { createWorkflow } from './utils'
import { NodeDetailPanelPage, WorkflowTreePage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

const test = createAdminTest('real-research-workflow')

type WorkflowNode = {
  id: string
  children: string[]
  title: string
  command?: string
  parent?: string
  collapsed?: boolean
  x?: number
  y?: number
  width?: number
  height?: number
}

type WorkflowResponse = {
  workflowId: string
  nodes?: Record<string, WorkflowNode>
}

const LIVE_RESEARCH_TIMEOUT = 420000
const POLL_INTERVAL_MS = 2000
const OUTPUT_TIMEOUT_MS = 210000
const PARSER_ERROR = 'Could not parse LLM output'

function makeNode(
  id: string,
  title: string,
  parent = '',
  children: string[] = [],
  command = title.startsWith('/') || title.startsWith('#') ? title : '',
): WorkflowNode {
  return {
    id,
    title,
    command,
    parent,
    children,
    collapsed: false,
    x: 0,
    y: 0,
    width: 320,
    height: 120,
  }
}

async function getWorkflow(page: Page, workflowId: string): Promise<WorkflowResponse> {
  const response = await page.request.get(`/api/v2/workflow/${workflowId}`)
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()) as WorkflowResponse
}

async function waitForWorkflow(
  page: Page,
  workflowId: string,
  predicate: (workflow: WorkflowResponse) => boolean,
  timeout = OUTPUT_TIMEOUT_MS,
): Promise<WorkflowResponse> {
  const deadline = Date.now() + timeout
  let lastWorkflow: WorkflowResponse | undefined

  while (Date.now() < deadline) {
    lastWorkflow = await getWorkflow(page, workflowId)
    if (predicate(lastWorkflow)) return lastWorkflow
    await page.waitForTimeout(POLL_INTERVAL_MS)
  }

  const visibleTitles = Object.values(lastWorkflow?.nodes ?? {})
    .map(node => node.title)
    .join('\n')
  throw new Error(`Timed out waiting for workflow condition. Last node titles:\n${visibleTitles}`)
}

function childTitles(workflow: WorkflowResponse, nodeId: string): string[] {
  const nodes = workflow.nodes ?? {}
  return (nodes[nodeId]?.children ?? []).map(childId => nodes[childId]?.title ?? '').filter(Boolean)
}

function generatedChildTitles(workflow: WorkflowResponse, nodeId: string): string[] {
  return childTitles(workflow, nodeId).filter(title => title.trim().length > 0)
}

function expectNoParserError(title: string) {
  expect(title).not.toContain(PARSER_ERROR)
}

function expectNoSlashFlagLeak(title: string) {
  expect(title).not.toContain('--xxs')
  expect(title).not.toContain('--context=')
  expect(title).not.toContain('--lang=')
  expect(title).not.toContain('--citation')
  expect(title).not.toContain('--min-year=')
  expect(title).not.toContain('--min_year=')
}

function expectNoParserOrError(title: string) {
  expectNoParserError(title)
  expect(title).not.toMatch(/^Error:/)
}

async function executeNode(page: Page, nodeId: string): Promise<void> {
  const tree = new WorkflowTreePage(page)
  const detail = new NodeDetailPanelPage(page)

  await tree.selectNode(nodeId)
  await detail.waitForComponent()
  await detail.execute()
}

async function seedResearchWorkflow(page: Page, workflowId: string, contextName: string) {
  const nodes: Record<string, WorkflowNode> = {
    root: makeNode('root', 'D5 real research command QA', '', ['corpus', 'fanout', 'directWeb', 'directScholar', 'fanin']),
    corpus: makeNode('corpus', 'Corpus branch for grounded D5 evidence', 'root', ['factA', 'factB', 'memorize']),
    factA: makeNode(
      'factA',
      'D5 mission anchor: MCP/RPC are first-class composable workflow commands and research outputs must be grounded in execution evidence.',
      'corpus',
    ),
    factB: makeNode(
      'factB',
      'Research family under D5 includes /web, /scholar, /ext, /outline, /memorize, and /download; nested workflows must support fan-out and fan-in.',
      'corpus',
    ),
    memorize: makeNode('memorize', `/memorize --context=${contextName} --rechunk`, 'corpus'),
    fanout: makeNode('fanout', 'Fan-out questions over the memorized D5 corpus', 'root', [
      'questionA',
      'questionB',
      'foreachExt',
    ]),
    questionA: makeNode('questionA', 'What does D5 require from MCP/RPC workflow commands?', 'fanout'),
    questionB: makeNode('questionB', 'Which research command family members are in scope?', 'fanout'),
    foreachExt: makeNode(
      'foreachExt',
      `/foreach /ext --context=${contextName} answer from the memorized D5 corpus: @@`,
      'fanout',
    ),
    directWeb: makeNode(
      'directWeb',
      '/web --xxs --lang=en --citation Model Context Protocol composable workflow commands',
      'root',
    ),
    directScholar: makeNode(
      'directScholar',
      '/scholar --min-year=2024 --xxs --lang=en --citation Model Context Protocol agent workflows',
      'root',
    ),
    fanin: makeNode(
      'fanin',
      '/summarize --xxs Fan-in: produce one short QA evidence digest from the executed research outputs.',
      'root',
    ),
  }

  const response = await page.request.put(`/api/v2/workflow/${workflowId}`, {
    data: {
      title: 'D5 #326 real research QA workflow',
      root: 'root',
      edges: {},
      nodes,
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
}

test.describe('Real research command workflows', () => {
  test.skip(process.env.D5_REAL_RESEARCH_E2E !== '1', 'Set D5_REAL_RESEARCH_E2E=1 for live research execution')
  test.setTimeout(LIVE_RESEARCH_TIMEOUT)

  let workflowId = ''

  test.afterEach(async ({ page }) => {
    if (workflowId) {
      await page.request.delete(`/api/v2/workflow/${workflowId}`).catch(() => {})
      workflowId = ''
    }
  })

  test('executes direct research commands and nested fan-out/fan-in through the UI', async ({ page }, testInfo) => {
    await page.goto('/workflows')
    workflowId = await createWorkflow(page)
    const contextName = `qa${Date.now().toString(36)}`

    await seedResearchWorkflow(page, workflowId, contextName)
    await page.goto(`/workflow/${workflowId}`)
    await page.getByTestId('workflow-tree-panel').waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const tree = new WorkflowTreePage(page)
    const detail = new NodeDetailPanelPage(page)

    await tree.selectNode('directScholar')
    await detail.waitForComponent()

    const commandField = detail.commandInput
    await commandField.click()
    await commandField.fill('/sch')
    const scholarSuggestion = page.locator('[data-type="autocomplete-item"][data-command="/scholar"]')
    await expect(scholarSuggestion).toBeVisible({ timeout: TIMEOUTS.UI_UPDATE })

    await commandField.fill('research command\n/')
    await expect(page.locator('[data-type="autocomplete-suggestions"]')).not.toBeVisible()
    await detail.fillCommand('/scholar --min-year=2024 --xxs --lang=en --citation Model Context Protocol agent workflows')

    await executeNode(page, 'directWeb')
    const afterWeb = await waitForWorkflow(page, workflowId, workflow => childTitles(workflow, 'directWeb').length > 0)
    const webOutput = generatedChildTitles(afterWeb, 'directWeb')[0]
    expectNoParserError(webOutput)
    expectNoSlashFlagLeak(webOutput)

    await executeNode(page, 'directScholar')
    const afterScholar = await waitForWorkflow(
      page,
      workflowId,
      workflow => childTitles(workflow, 'directScholar').length > 0,
    )
    const scholarOutput = generatedChildTitles(afterScholar, 'directScholar')[0]
    expectNoParserError(scholarOutput)
    expectNoSlashFlagLeak(scholarOutput)

    await executeNode(page, 'memorize')
    await waitForWorkflow(page, workflowId, workflow =>
      childTitles(workflow, 'memorize').some(title => title.includes(`Memorized`) && title.includes(contextName)),
    )

    await executeNode(page, 'foreachExt')
    const afterFanOut = await waitForWorkflow(
      page,
      workflowId,
      workflow =>
        generatedChildTitles(workflow, 'questionA').length > 0 &&
        generatedChildTitles(workflow, 'questionB').length > 0,
    )

    const fanOutOutputs = [
      ...generatedChildTitles(afterFanOut, 'questionA'),
      ...generatedChildTitles(afterFanOut, 'questionB'),
    ]
    expect(fanOutOutputs.length).toBeGreaterThanOrEqual(2)
    fanOutOutputs.forEach(expectNoParserOrError)
    expect(fanOutOutputs.join('\n')).toMatch(/D5|MCP|research|workflow/i)

    await executeNode(page, 'fanin')
    const afterFanIn = await waitForWorkflow(page, workflowId, workflow => generatedChildTitles(workflow, 'fanin').length > 0)
    const fanInOutput = generatedChildTitles(afterFanIn, 'fanin')[0]
    expectNoParserOrError(fanInOutput)
    expect(fanInOutput.length).toBeGreaterThan(20)

    await testInfo.attach('research-workflow-final.json', {
      contentType: 'application/json',
      body: JSON.stringify(afterFanIn, null, 2),
    })
  })
})
