import { test, expect } from '@playwright/test'
import { qaBotLogin, createWorkflow } from './utils'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'

const LLM_TIMEOUT = 120_000
const SUFFIX_RE = /\[(?:✓|✗)[^\]]+\]/
const COMMODITY_FULL_SUCCESS_SUFFIX_RE = (n: number) => new RegExp(`\\[✓ ${n}\\/${n}\\]`)
const COMMODITY_OUTCOME_SUFFIX_RE = /\[(✓|✗) (\d+)\/(\d+)\]/
const VALIDATE_VERDICT_RE = /\[(?:✓(?:\s+retry-\d+)?|✗\s+\d+\s+attempts)\]/
const VALIDATE_FAIL_RE = /\[✗\s+\d+\s+attempts\]/
const REFINE_FALLBACK_SUFFIX_RE = /\[⚠ fallback: 0\/2 passed; chose fork-\d+\]/
const COMMODITY_DETERMINISTIC_FULL_SUCCESS_CASES = [
  { n: 2, task: 'List 3 colors' },
  { n: 3, task: 'List 3 fruits' },
  { n: 5, task: 'List 3 animals' },
] as const

async function purgeQaBotWorkflows(page: Parameters<typeof qaBotLogin>[0]) {
  /* qa-bot has LimitWorkflows=10 (seeded by backend-v2/cmd/seed-users); without
     this purge, 10× test.beforeEach × 2 browsers saturates the cap and the next
     POST /workflow returns 402 silently — page never navigates, waitForURL
     times out at 15s.
     Retry loop: parallel workers share the same qa-bot user, so the other
     browser can re-fill the quota between our GET and DELETE; loop until the
     listing comes back empty (or we exhaust attempts). */
  for (let attempt = 0; attempt < 10; attempt++) {
    const resp = await page.request.get('/api/v2/workflow?public=false&limit=100')
    if (!resp.ok()) {
      await page.waitForTimeout(500)
      continue
    }
    const body = await resp.json().catch(() => ({ data: [] as Array<{ workflowId: string }> }))
    const ids: string[] = (body.data ?? []).map((w: { workflowId: string }) => w.workflowId).filter(Boolean)
    if (ids.length === 0) return
    await Promise.all(ids.map(id => page.request.delete(`/api/v2/workflow/${id}`).catch(() => {})))
    await page.waitForTimeout(400)
  }
}

async function setupLLMWorkflow(page: Parameters<typeof qaBotLogin>[0]) {
  await page.goto('/workflows')
  await qaBotLogin(page)
  for (let attempt = 0; attempt < 3; attempt++) {
    await purgeQaBotWorkflows(page)
    try {
      await createWorkflow(page)
      break
    } catch (err) {
      if (attempt === 2) throw err
      await page.waitForTimeout(1000 * (attempt + 1))
    }
  }
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

async function executeAndWaitForCompletion(page: Parameters<typeof qaBotLogin>[0], detail: NodeDetailPanelPage) {
  const executeResponse = page.waitForResponse(
    resp => new URL(resp.url()).pathname.endsWith('/execute') && resp.request().method() === 'POST',
    { timeout: LLM_TIMEOUT },
  )
  await detail.execute()
  await executeResponse
  await expect(page.getByTestId('abort-node-button')).toBeHidden({ timeout: TIMEOUTS.BACKEND_SYNC })
}

async function nodeTitle(page: Parameters<typeof qaBotLogin>[0], nodeId: string): Promise<string> {
  const text = await page.locator(`[data-node-id="${nodeId}"]`).textContent()
  return text?.trim() ?? ''
}

async function expectRootWithCommodityChildren(tree: WorkflowTreePage, n: number) {
  await expect(tree.nodes).toHaveCount(n + 1, { timeout: TIMEOUTS.BACKEND_SYNC })
}

async function executeCommodityCommand(page: Parameters<typeof qaBotLogin>[0], command: string) {
  const tree = new WorkflowTreePage(page)
  const { detail, rootId } = await selectRootAndOpenDetail(page)
  await detail.fillCommand(command)
  await executeAndWaitForCompletion(page, detail)
  await expect(tree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
  return { tree, rootId }
}

async function expectCommodityFullSuccess(
  page: Parameters<typeof qaBotLogin>[0],
  tree: WorkflowTreePage,
  rootId: string,
  n: number,
) {
  expect(await nodeTitle(page, rootId)).toMatch(COMMODITY_FULL_SUCCESS_SUFFIX_RE(n))
  expect(await persistedChildTitles(page, rootId)).toHaveLength(n)
  await expectRootWithCommodityChildren(tree, n)
}

async function expectCommodityOutcomeMatchesChildren(
  page: Parameters<typeof qaBotLogin>[0],
  tree: WorkflowTreePage,
  rootId: string,
  expectedTotal: number,
) {
  const title = await nodeTitle(page, rootId)
  const match = title.match(COMMODITY_OUTCOME_SUFFIX_RE)
  expect(match).not.toBeNull()

  const [, status, successText, totalText] = match as RegExpMatchArray
  const successCount = Number(successText)
  const total = Number(totalText)

  expect(total).toBe(expectedTotal)
  expect(successCount).toBeGreaterThanOrEqual(0)
  expect(successCount).toBeLessThanOrEqual(expectedTotal)
  expect(status).toBe(successCount === 0 ? '✗' : '✓')
  expect(await persistedChildTitles(page, rootId)).toHaveLength(successCount)
  await expect(tree.nodes).toHaveCount(successCount + 1, { timeout: TIMEOUTS.BACKEND_SYNC })
}

async function expectNoCommodityTokenInChildren(page: Parameters<typeof qaBotLogin>[0], tree: WorkflowTreePage) {
  const count = await tree.nodes.count()
  for (let i = 1; i < count; i++) {
    const childId = await tree.nodeIdAt(i)
    const title = await nodeTitle(page, childId)
    expect(title).not.toContain(':n=')
  }
}

async function addChildCommand(
  page: Parameters<typeof qaBotLogin>[0],
  tree: WorkflowTreePage,
  parentId: string,
  command: string,
) {
  await tree.selectNode(parentId)
  const parentDetail = new NodeDetailPanelPage(page)
  await parentDetail.waitForComponent()
  const childIndex = await tree.nodes.count()
  await parentDetail.addChild()
  await tree.nodes.nth(childIndex).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })

  const childId = await tree.nodeIdAt(childIndex)
  await tree.selectNode(childId)
  const childDetail = new NodeDetailPanelPage(page)
  await childDetail.waitForComponent()
  await childDetail.fillCommand(command)
  return childId
}

async function executeRoot(page: Parameters<typeof qaBotLogin>[0], tree: WorkflowTreePage, rootId: string) {
  await tree.selectNode(rootId)
  const rootDetail = new NodeDetailPanelPage(page)
  await rootDetail.waitForComponent()
  await executeAndWaitForCompletion(page, rootDetail)
}

async function expectValidateFailure(page: Parameters<typeof qaBotLogin>[0], validateId: string) {
  expect(await nodeTitle(page, validateId)).toMatch(VALIDATE_FAIL_RE)
}

async function assertForeachValidateContractFor(
  page: Parameters<typeof qaBotLogin>[0],
  foreachCommand: string,
) {
  const contentKeyedSentinel = 'MOCK_VALIDATE_FAIL_IF_CONTENT_CONTAINS=Beta'

  const tree = new WorkflowTreePage(page)
  const { rootId } = await selectRootAndOpenDetail(page)
  const batchId = await addChildCommand(page, tree, rootId, 'Batch')

  const alphaId = await addChildCommand(page, tree, batchId, 'Alpha')
  const betaId = await addChildCommand(page, tree, batchId, 'Beta')
  const gammaId = await addChildCommand(page, tree, batchId, 'Gamma')
  const foreachId = await addChildCommand(page, tree, batchId, foreachCommand)
  await addChildCommand(
    page,
    tree,
    foreachId,
    `/validate :retry=0 ${contentKeyedSentinel} — Beta fails only`,
  )

  await tree.selectNode(foreachId)
  const foreachDetail = new NodeDetailPanelPage(page)
  await foreachDetail.waitForComponent()
  await executeAndWaitForCompletion(page, foreachDetail)

  const snapshot = await loadWorkflowSnapshot(page)

  const validateVerdicts = validateTitlesOwnedByIterations(
    snapshot,
    contentKeyedSentinel,
    [alphaId, betaId, gammaId],
  )
  expect(validateVerdicts).toHaveLength(3)
  expect(validateVerdicts.filter(title => /\[✓\]/.test(title))).toHaveLength(2)
  expect(validateVerdicts.filter(title => /\[✗\s+\d+\s+attempts\]/.test(title))).toHaveLength(1)

  const templateNodes = Object.values(snapshot.nodes ?? {}).filter(
    n => n.parent === foreachId && String(n.title ?? '').includes(contentKeyedSentinel),
  )
  expect(templateNodes).toHaveLength(1)
  expect(String(templateNodes[0].title ?? '')).not.toMatch(VALIDATE_VERDICT_RE)

  const verdictsUnderForeach = Object.values(snapshot.nodes ?? {}).filter(n => {
    const title = String(n.title ?? '')
    return title.includes(contentKeyedSentinel) && n.parent === foreachId && VALIDATE_VERDICT_RE.test(title)
  })
  expect(verdictsUnderForeach).toHaveLength(0)
}

type WorkflowNodeSnapshot = {
  title?: string
  parent?: string
}

type WorkflowSnapshot = {
  nodes?: Record<string, WorkflowNodeSnapshot>
}

async function loadWorkflowSnapshot(page: Parameters<typeof qaBotLogin>[0]): Promise<WorkflowSnapshot> {
  const workflowId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()
  const workflowResponse = await page.request.get(`/api/v2/workflow/${workflowId}`)
  expect(workflowResponse.ok()).toBeTruthy()
  return workflowResponse.json()
}

async function persistedChildTitles(page: Parameters<typeof qaBotLogin>[0], parentId: string): Promise<string[]> {
  const snapshot = await loadWorkflowSnapshot(page)
  return Object.values(snapshot.nodes ?? {})
    .filter(node => node.parent === parentId)
    .map(node => String(node.title ?? ''))
}

function validateTitlesOwnedByIterations(
  workflow: WorkflowSnapshot,
  criterionMarker: string,
  iterationIds: string[],
): string[] {
  const workflowNodes = workflow.nodes ?? {}
  const iterationIdSet = new Set(iterationIds)

  return Object.values(workflowNodes)
    .filter(node => {
      const title = String(node.title ?? '')
      return title.includes(criterionMarker) && iterationIdSet.has(node.parent ?? '')
    })
    .map(node => String(node.title ?? ''))
}

test.describe('Reliability execution contracts', () => {
  test.setTimeout(LLM_TIMEOUT * 2)

  test.beforeEach(async ({ page }) => {
    await setupLLMWorkflow(page)
  })
  COMMODITY_DETERMINISTIC_FULL_SUCCESS_CASES.forEach(({ n, task }) => {
    test(`commodity :n=${n} — deterministic full-success suffix and child count match N`, async ({ page }) => {
      const { tree, rootId } = await executeCommodityCommand(page, `/chat :n=${n} ${task}`)
      await expectCommodityFullSuccess(page, tree, rootId, n)
    })
  })

  test('bestOf — prompt children populated with real LLM output', async ({ page }) => {
    const { tree } = await executeCommodityCommand(page, '/chat :n=2 List 3 colors')
    const childTitle = await nodeTitle(page, await tree.nodeIdAt(1))
    expect(childTitle.length).toBeGreaterThan(0)
  })

  test('commodity :n=2 — provider smoke reports actual fork outcome honestly', async ({ page }) => {
    const { tree, rootId } = await executeCommodityCommand(page, '/chat :n=2 List 3 colors')
    await expectCommodityOutcomeMatchesChildren(page, tree, rootId, 2)
  })

  test('refine :n=2 — suffix shows candidate count not [✓ refined]', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    const refineId = await addChildCommand(page, tree, rootId, '/refine :n=2')
    await executeRoot(page, tree, rootId)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(SUFFIX_RE)
    expect(refineTitle).not.toMatch(/\[✓ refined\]/)
    expect(refineTitle).toMatch(/\[✓ \d+\/2/)
  })

  test('refine :n=3 — suffix shows candidate count', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=3 List 3 fruits')
    const refineId = await addChildCommand(page, tree, rootId, '/refine :n=3')
    await executeRoot(page, tree, rootId)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(SUFFIX_RE)
    expect(refineTitle).not.toMatch(/\[✓ refined\]/)
    expect(refineTitle).toMatch(/\[(?:✓|✗) \d+\/3/)
  })

  test('validate — Job 1 writes suffix on the validate cell after parent post-processing', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    const validateId = await addChildCommand(page, tree, rootId, '/validate Each item must be a distinct color name')
    await executeRoot(page, tree, rootId)

    expect(await nodeTitle(page, validateId)).toMatch(VALIDATE_VERDICT_RE)
  })

  test('foreach validate — sequential: each iteration shows its own pass or fail verdict', async ({ page }) => {
    await assertForeachValidateContractFor(page, '/foreach /chat @@ --parallel=no')
  })

  test('foreach validate — parallel: each iteration shows its own pass or fail verdict', async ({ page }) => {
    await assertForeachValidateContractFor(page, '/foreach /chat @@')
  })

  test('executing visual state — abort button visible while running', async ({ page }) => {
    const { detail } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    await detail.execute()

    await expect(page.getByTestId('abort-node-button')).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    await page.getByTestId('abort-node-button').waitFor({ state: 'hidden', timeout: LLM_TIMEOUT })
    await expect(page.getByTestId('abort-node-button')).not.toBeVisible()
  })

  test('reload persistence — deterministic commodity full-success survives page reload', async ({ page }) => {
    const { tree, rootId } = await executeCommodityCommand(page, '/chat :n=2 List 3 colors')

    const countBeforeReload = await tree.nodes.count()
    expect(countBeforeReload).toBe(3)
    const titleBefore = await nodeTitle(page, rootId)
    expect(titleBefore).toMatch(COMMODITY_FULL_SUCCESS_SUFFIX_RE(2))

    await page.reload()
    await page.waitForLoadState('networkidle')

    const reloadedTree = new WorkflowTreePage(page)
    await expect(reloadedTree.nodes.first()).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    expect(await reloadedTree.nodes.count()).toBe(countBeforeReload)
    const titleAfter = await nodeTitle(page, rootId)
    expect(titleAfter).toMatch(COMMODITY_FULL_SUCCESS_SUFFIX_RE(2))
  })

  test('validate Job 1 exhaustion — failure suffix on the validate cell', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    const validateId = await addChildCommand(
      page,
      tree,
      rootId,
      '/validate MOCK_VALIDATE_FAIL — The output must be a valid JSON object with key "data" and value 999',
    )
    await executeRoot(page, tree, rootId)

    await expectValidateFailure(page, validateId)
  })

  test('refine fallback commits a visibly degraded winner when every criteria-checked fork fails', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 Write one sentence about weather')
    const refineId = await addChildCommand(page, tree, rootId, '/refine :n=2 :fallback')
    const validateId = await addChildCommand(page, tree, refineId, '/validate MOCK_VALIDATE_FAIL — must never pass')

    await executeRoot(page, tree, rootId)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(REFINE_FALLBACK_SUFFIX_RE)
    await expectValidateFailure(page, validateId)
  })

  test('nested refine topology executes inner commands in each fork and propagates descendant validate failure', async ({
    page,
  }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat Write one sentence about the weather')
    const refineId = await addChildCommand(page, tree, rootId, '/refine :n=2 :fallback')
    const innerChatId = await addChildCommand(page, tree, refineId, '/chat Reply with exactly: HELLO WORLD')
    const validateId = await addChildCommand(
      page,
      tree,
      innerChatId,
      '/validate MOCK_VALIDATE_FAIL — Output must contain DEFINITELY_UNREACHABLE_TOKEN_42',
    )

    await executeRoot(page, tree, rootId)

    const refineTitle = await nodeTitle(page, refineId)
    expect(refineTitle).toMatch(REFINE_FALLBACK_SUFFIX_RE)
    await expectValidateFailure(page, validateId)
  })

  test('commodity ceiling disclosure appears only for plain commodity LLM commands', async ({ page }) => {
    const { detail } = await selectRootAndOpenDetail(page)

    await detail.fillCommand('/chat :n=2 Say OK')
    await expect(page.getByTestId('commodity-ceiling-hint')).toBeVisible()

    await detail.fillCommand('/chat Say OK')
    await expect(page.getByTestId('commodity-ceiling-hint')).not.toBeVisible()

    await detail.fillCommand('/refine :n=2 Say OK')
    await expect(page.getByTestId('commodity-ceiling-hint')).not.toBeVisible()
  })

  test('commodity control parameter does not appear in generated child content', async ({ page }) => {
    const { tree } = await executeCommodityCommand(page, '/chat :n=2 Reply with one word: hello')
    await expectNoCommodityTokenInChildren(page, tree)
  })
})
