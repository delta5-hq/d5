import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

const LLM_TIMEOUT = 120_000
const SUFFIX_RE = /\[(?:✓|✗)[^\]]+\]/

async function setupLLMWorkflow(page: Parameters<typeof adminLogin>[0]) {
  await page.goto('/workflows')
  await adminLogin(page)
  await createWorkflow(page)
  await page.waitForLoadState('networkidle')
  await page.getByTestId('create-first-node').click()
  await page.locator('[data-node-id]').first().waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
}

async function selectRootAndOpenDetail(page: Parameters<typeof adminLogin>[0]) {
  const tree = new WorkflowTreePage(page)
  const detail = new NodeDetailPanelPage(page)
  const rootId = await tree.rootNodeId()
  await tree.selectNode(rootId)
  await detail.waitForComponent()
  return { tree, detail, rootId }
}

async function executeAndWaitForCompletion(
  page: Parameters<typeof adminLogin>[0],
  detail: NodeDetailPanelPage,
) {
  await detail.execute()
  await page.getByTestId('abort-node-button').waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
  await page.getByTestId('abort-node-button').waitFor({ state: 'hidden', timeout: LLM_TIMEOUT })
}

async function nodeTitle(page: Parameters<typeof adminLogin>[0], nodeId: string): Promise<string> {
  const text = await page.locator(`[data-node-id="${nodeId}"]`).textContent()
  return text?.trim() ?? ''
}

test.describe('P0.7 — bestOf / refine reliability QA', () => {
  test.setTimeout(LLM_TIMEOUT * 2)

  test.beforeEach(async ({ page }) => {
    await setupLLMWorkflow(page)
  })

  test('bestOf :n=2 — suffix grammar on success', async ({ page }) => {
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')

    await executeAndWaitForCompletion(page, detail)

    const title = await nodeTitle(page, rootId)
    expect(title).toMatch(SUFFIX_RE)
    expect(title).toMatch(/\[✓ \d+\/2 (?:best of 2|first-survivor)/)
  })

  test('bestOf :n=3 — suffix grammar on success', async ({ page }) => {
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=3 List 3 fruits')

    await executeAndWaitForCompletion(page, detail)

    const title = await nodeTitle(page, rootId)
    expect(title).toMatch(SUFFIX_RE)
    expect(title).toMatch(/\[✓ \d+\/3 (?:best of 3|first-survivor)/)
  })

  test('bestOf :n=5 — suffix grammar on success', async ({ page }) => {
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=5 List 3 animals')

    await executeAndWaitForCompletion(page, detail)

    const title = await nodeTitle(page, rootId)
    expect(title).toMatch(SUFFIX_RE)
    expect(title).toMatch(/\[(?:✓|✗) \d+\/5/)
  })

  test('bestOf — prompt children populated with real LLM output', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')

    await executeAndWaitForCompletion(page, detail)

    await expect(tree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    const count = await tree.nodes.count()
    expect(count).toBeGreaterThanOrEqual(2)
    const childTitle = await nodeTitle(page, await tree.nodeIdAt(1))
    expect(childTitle.length).toBeGreaterThan(0)
  })

  test('refine :n=2 — suffix shows candidate count not [✓ refined]', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await detail.addChild()
    await page.locator('[data-node-id]').nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const refineId = await tree.nodeIdAt(1)
    await tree.selectNode(refineId)
    const refineDetail = new NodeDetailPanelPage(page)
    await refineDetail.waitForComponent()
    await refineDetail.fillCommand('/refine :n=2')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await executeAndWaitForCompletion(page, detail)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(SUFFIX_RE)
    expect(refineTitle).not.toMatch(/\[✓ refined\]/)
    expect(refineTitle).toMatch(/\[✓ \d+\/2/)
  })

  test('refine :n=3 — suffix shows candidate count', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=3 List 3 fruits')
    await detail.addChild()
    await page.locator('[data-node-id]').nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const refineId = await tree.nodeIdAt(1)
    await tree.selectNode(refineId)
    const refineDetail = new NodeDetailPanelPage(page)
    await refineDetail.waitForComponent()
    await refineDetail.fillCommand('/refine :n=3')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await executeAndWaitForCompletion(page, detail)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(SUFFIX_RE)
    expect(refineTitle).not.toMatch(/\[✓ refined\]/)
    expect(refineTitle).toMatch(/\[(?:✓|✗) \d+\/3/)
  })

  test('validate — child /validate criteria forwarded to judge', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await detail.addChild()
    await page.locator('[data-node-id]').nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const validateId = await tree.nodeIdAt(1)
    await tree.selectNode(validateId)
    const validateDetail = new NodeDetailPanelPage(page)
    await validateDetail.waitForComponent()
    await validateDetail.fillCommand('/validate Each item must be a distinct color name')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await executeAndWaitForCompletion(page, detail)

    const rootTitle = await nodeTitle(page, rootId)
    expect(rootTitle).toMatch(SUFFIX_RE)
  })

  test('executing visual state — abort button visible while running', async ({ page }) => {
    const { detail } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await detail.execute()

    await expect(page.getByTestId('abort-node-button')).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await page.getByTestId('abort-node-button').waitFor({ state: 'hidden', timeout: LLM_TIMEOUT })
    await expect(page.getByTestId('abort-node-button')).not.toBeVisible()
  })

  test('reload persistence — suffix survives page reload', async ({ page }) => {
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await executeAndWaitForCompletion(page, detail)

    const titleBeforeReload = await nodeTitle(page, rootId)
    expect(titleBeforeReload).toMatch(SUFFIX_RE)

    await page.reload()
    await page.waitForLoadState('networkidle')

    const titleAfterReload = await nodeTitle(page, rootId)
    expect(titleAfterReload).toMatch(SUFFIX_RE)
  })

  test('suffix grammar on all-fail — gate failure suffix written', async ({ page }) => {
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await detail.addChild()
    const tree = new WorkflowTreePage(page)
    await page.locator('[data-node-id]').nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const validateId = await tree.nodeIdAt(1)
    await tree.selectNode(validateId)
    const validateDetail = new NodeDetailPanelPage(page)
    await validateDetail.waitForComponent()
    await validateDetail.fillCommand('/validate The output must be a valid JSON object with key "data" and value 999')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await executeAndWaitForCompletion(page, detail)

    const rootTitle = await nodeTitle(page, rootId)
    expect(rootTitle).toMatch(SUFFIX_RE)
  })
})
