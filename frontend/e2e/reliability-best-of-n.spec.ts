import { test, expect } from '@playwright/test'
import { qaBotLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

const LLM_TIMEOUT = 120_000
const SUFFIX_RE = /\[(?:✓|✗)[^\]]+\]/
const COMMODITY_SUFFIX_RE = (n: number) => new RegExp(`\\[(?:✓|✗) \\d+\\/${n}\\]`)
const VALIDATE_VERDICT_RE = /\[(?:✓(?:\s+retry-\d+)?|✗\s+\d+\s+attempts)\]/
const VALIDATE_FAIL_RE = /\[✗\s+\d+\s+attempts\]/

async function purgeQaBotWorkflows(page: Parameters<typeof qaBotLogin>[0]) {
  /* qa-bot has LimitWorkflows=10 (seeded by backend-v2/cmd/seed-users); without
     this purge, 10× test.beforeEach × 2 browsers saturates the cap and the next
     POST /workflow returns 402 silently — page never navigates, waitForURL
     times out at 15s. Grounded via test-results page snapshot showing 10
     accumulated qa-bot workflow cards at failure point. */
  const resp = await page.request.get('/api/v2/workflow?public=false&limit=100')
  if (!resp.ok()) return
  const body = await resp.json().catch(() => ({ data: [] as Array<{ workflowId: string }> }))
  const ids: string[] = (body.data ?? []).map((w: { workflowId: string }) => w.workflowId).filter(Boolean)
  await Promise.all(ids.map(id => page.request.delete(`/api/v2/workflow/${id}`).catch(() => {})))
}

async function setupLLMWorkflow(page: Parameters<typeof qaBotLogin>[0]) {
  await page.goto('/workflows')
  await qaBotLogin(page)
  await purgeQaBotWorkflows(page)
  await createWorkflow(page)
  await page.waitForLoadState('networkidle')
  await page.getByTestId('create-first-node').click()
  await page.locator('[data-node-id]').first().waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
}

async function selectRootAndOpenDetail(page: Parameters<typeof qaBotLogin>[0]) {
  const tree = new WorkflowTreePage(page)
  const detail = new NodeDetailPanelPage(page)
  const rootId = await tree.rootNodeId()
  await tree.selectNode(rootId)
  await detail.waitForComponent()
  return { tree, detail, rootId }
}

async function executeAndWaitForCompletion(
  page: Parameters<typeof qaBotLogin>[0],
  detail: NodeDetailPanelPage,
) {
  await detail.execute()
  await page.getByTestId('abort-node-button').waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
  await page.getByTestId('abort-node-button').waitFor({ state: 'hidden', timeout: LLM_TIMEOUT })
}

async function nodeTitle(page: Parameters<typeof qaBotLogin>[0], nodeId: string): Promise<string> {
  const text = await page.locator(`[data-node-id="${nodeId}"]`).textContent()
  return text?.trim() ?? ''
}

test.describe('P0.7 — bestOf / refine reliability QA', () => {
  test.setTimeout(LLM_TIMEOUT * 2)

  test.beforeEach(async ({ page }) => {
    await setupLLMWorkflow(page)
  })

  test('bestOf :n=2 — commodity writes [(?:✓|✗) K/2] suffix on plain LLM cell', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')

    await executeAndWaitForCompletion(page, detail)

    await expect(tree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    const rootTitle = await nodeTitle(page, rootId)
    expect(rootTitle).toMatch(COMMODITY_SUFFIX_RE(2))
    expect(await tree.nodes.count()).toBeGreaterThanOrEqual(2)
  })

  test('bestOf :n=3 — commodity writes [(?:✓|✗) K/3] suffix on plain LLM cell', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=3 List 3 fruits')

    await executeAndWaitForCompletion(page, detail)

    await expect(tree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    const rootTitle = await nodeTitle(page, rootId)
    expect(rootTitle).toMatch(COMMODITY_SUFFIX_RE(3))
    expect(await tree.nodes.count()).toBeGreaterThanOrEqual(2)
  })

  test('bestOf :n=5 — commodity writes [(?:✓|✗) K/5] suffix on plain LLM cell', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=5 List 3 animals')

    await executeAndWaitForCompletion(page, detail)

    await expect(tree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    const rootTitle = await nodeTitle(page, rootId)
    expect(rootTitle).toMatch(COMMODITY_SUFFIX_RE(5))
    expect(await tree.nodes.count()).toBeGreaterThanOrEqual(2)
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

  test('validate — Job 1 writes suffix on the validate cell after parent post-processing', async ({ page }) => {
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

    expect(await nodeTitle(page, validateId)).toMatch(VALIDATE_VERDICT_RE)
  })

  test('executing visual state — abort button visible while running', async ({ page }) => {
    const { detail } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await detail.execute()

    await expect(page.getByTestId('abort-node-button')).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await page.getByTestId('abort-node-button').waitFor({ state: 'hidden', timeout: LLM_TIMEOUT })
    await expect(page.getByTestId('abort-node-button')).not.toBeVisible()
  })

  test('reload persistence — commodity suffix and child outputs survive page reload', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await executeAndWaitForCompletion(page, detail)

    const countBeforeReload = await tree.nodes.count()
    expect(countBeforeReload).toBeGreaterThanOrEqual(2)
    const titleBefore = await nodeTitle(page, rootId)
    expect(titleBefore).toMatch(COMMODITY_SUFFIX_RE(2))

    await page.reload()
    await page.waitForLoadState('networkidle')

    const reloadedTree = new WorkflowTreePage(page)
    await expect(reloadedTree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    expect(await reloadedTree.nodes.count()).toBe(countBeforeReload)
    const titleAfter = await nodeTitle(page, rootId)
    expect(titleAfter).toMatch(COMMODITY_SUFFIX_RE(2))
  })

  test('validate Job 1 exhaustion — failure suffix on the validate cell', async ({ page }) => {
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await detail.addChild()
    const tree = new WorkflowTreePage(page)
    await page.locator('[data-node-id]').nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const validateId = await tree.nodeIdAt(1)
    await tree.selectNode(validateId)
    const validateDetail = new NodeDetailPanelPage(page)
    await validateDetail.waitForComponent()
    await validateDetail.fillCommand('/validate REJECT — The output must be a valid JSON object with key "data" and value 999')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await executeAndWaitForCompletion(page, detail)

    expect(await nodeTitle(page, validateId)).toMatch(VALIDATE_FAIL_RE)
  })

  test('refine :n=2 :fallback + REJECT criterion — [⚠ fallback: 0/2 passed; chose fork-N] suffix, validate [✗] suffix', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 Write one sentence about weather')
    await detail.addChild()
    await page.locator('[data-node-id]').nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const refineId = await tree.nodeIdAt(1)
    await tree.selectNode(refineId)
    const refineDetail = new NodeDetailPanelPage(page)
    await refineDetail.waitForComponent()
    await refineDetail.fillCommand('/refine :n=2 :fallback')
    await refineDetail.addChild()
    await page.locator('[data-node-id]').nth(2).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const validateId = await tree.nodeIdAt(2)
    await tree.selectNode(validateId)
    const validateDetail = new NodeDetailPanelPage(page)
    await validateDetail.waitForComponent()
    await validateDetail.fillCommand('/validate REJECT — must never pass')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await executeAndWaitForCompletion(page, detail)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(/\[⚠ fallback: 0\/2 passed; chose fork-\d+\]/)
    expect(await nodeTitle(page, validateId)).toMatch(VALIDATE_FAIL_RE)
  })
  test('P0.39 grandchild topology — /refine :n=2 :fallback + inner /chat + /validate grandchild, inner /chat executes per fork, [⚠ fallback] and [✗] suffixes propagate', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat Write one sentence about the weather')
    await detail.addChild()
    await page.locator('[data-node-id]').nth(1).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const refineId = await tree.nodeIdAt(1)
    await tree.selectNode(refineId)
    const refineDetail = new NodeDetailPanelPage(page)
    await refineDetail.waitForComponent()
    await refineDetail.fillCommand('/refine :n=2 :fallback')
    await refineDetail.addChild()
    await page.locator('[data-node-id]').nth(2).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const innerChatId = await tree.nodeIdAt(2)
    await tree.selectNode(innerChatId)
    const innerChatDetail = new NodeDetailPanelPage(page)
    await innerChatDetail.waitForComponent()
    await innerChatDetail.fillCommand('/chat Reply with exactly: HELLO WORLD')
    await innerChatDetail.addChild()
    await page.locator('[data-node-id]').nth(3).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

    const validateId = await tree.nodeIdAt(3)
    await tree.selectNode(validateId)
    const validateDetail = new NodeDetailPanelPage(page)
    await validateDetail.waitForComponent()
    await validateDetail.fillCommand('/validate REJECT — Output must contain DEFINITELY_UNREACHABLE_TOKEN_42')

    await tree.selectNode(rootId)
    await detail.waitForComponent()
    await executeAndWaitForCompletion(page, detail)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(/\[⚠ fallback: 0\/2 passed; chose fork-\d+\]/)
    expect(await nodeTitle(page, validateId)).toMatch(VALIDATE_FAIL_RE)
  })
})
