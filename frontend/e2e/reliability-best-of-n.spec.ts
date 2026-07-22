import { test, expect } from '@playwright/test'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { LLM_TIMEOUT, TIMEOUTS } from './config/test-timeouts'
import {
  COMPLETION_SUFFIX_RE,
  COMMODITY_FULL_SUCCESS_SUFFIX_RE,
  REFINE_FALLBACK_SUFFIX_RE,
  VALIDATE_VERDICT_RE,
} from './reliability/suffix-patterns'
import { setupLLMWorkflow } from './reliability/workflow-lifecycle'
import {
  nodeTitle,
  awaitNodeTitle,
  selectRootAndOpenDetail,
  addChildCommand,
  executeAndWaitForCompletion,
  executeRoot,
  executeCommodityCommand,
} from './reliability/node-interaction'
import {
  expectCommodityFullSuccess,
  expectCommodityOutcomeMatchesChildren,
  expectNoCommodityTokenInChildren,
  expectValidateFailure,
} from './reliability/assertions'
import { assertForeachValidateContractFor } from './reliability/foreach-validate'

const COMMODITY_DETERMINISTIC_FULL_SUCCESS_CASES = [
  { n: 2, task: 'List 3 colors' },
  { n: 3, task: 'List 3 fruits' },
  { n: 5, task: 'List 3 animals' },
] as const

const REFINE_SUFFIX_CASES = [
  { n: 2, task: 'List 3 colors', suffixPattern: /\[✓ \d+\/2/ },
  { n: 3, task: 'List 3 fruits', suffixPattern: /\[(?:✓|✗) \d+\/3/ },
] as const

test.describe('Reliability execution contracts', () => {
  test.setTimeout(LLM_TIMEOUT * 2)

  test.beforeEach(async ({ page }) => {
    await setupLLMWorkflow(page)
  })

  // ── Commodity fork count and suffix ────────────────────────────────────────

  COMMODITY_DETERMINISTIC_FULL_SUCCESS_CASES.forEach(({ n, task }) => {
    test(`commodity :n=${n} — full-success suffix [✓ N/N] and child count equal N`, async ({ page }) => {
      const { tree, rootId } = await executeCommodityCommand(page, `/chat :n=${n} ${task}`)
      await expectCommodityFullSuccess(page, tree, rootId, n)
    })
  })

  test('commodity — fork outcome suffix honestly reflects actual child node count', async ({ page }) => {
    const { tree, rootId } = await executeCommodityCommand(page, '/chat :n=2 List 3 colors')
    await expectCommodityOutcomeMatchesChildren(page, tree, rootId, 2)
  })

  test('commodity — fork child cells are populated with real LLM output', async ({ page }) => {
    const { tree } = await executeCommodityCommand(page, '/chat :n=2 List 3 colors')
    const childTitle = await nodeTitle(page, await tree.nodeIdAt(1))
    expect(childTitle.length).toBeGreaterThan(0)
    expect(childTitle).not.toMatch(COMPLETION_SUFFIX_RE)
  })

  test('commodity — fork control parameter :n= does not propagate into child node titles', async ({ page }) => {
    const { tree } = await executeCommodityCommand(page, '/chat :n=2 Reply with one word: hello')
    await expectNoCommodityTokenInChildren(page, tree)
  })

  // ── Refine fork suffix ─────────────────────────────────────────────────────

  REFINE_SUFFIX_CASES.forEach(({ n, task, suffixPattern }) => {
    test(`refine :n=${n} — suffix reports candidate count, not legacy [✓ refined]`, async ({ page }) => {
      const tree = new WorkflowTreePage(page)
      const { detail, rootId } = await selectRootAndOpenDetail(page)
      await detail.fillCommand(`/chat :n=${n} ${task}`)
      const refineId = await addChildCommand(page, tree, rootId, `/refine :n=${n}`)
      await executeRoot(page, tree, rootId)

      const refineTitle = await awaitNodeTitle(page, refineId, COMPLETION_SUFFIX_RE)
      expect(refineTitle).not.toMatch(/\[✓ refined\]/)
      expect(refineTitle).toMatch(suffixPattern)
    })
  })

  test('refine :fallback — commits a fallback winner when all criteria-checked forks fail', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 Write one sentence about weather')
    const refineId = await addChildCommand(page, tree, rootId, '/refine :n=2 :fallback')
    const validateId = await addChildCommand(page, tree, refineId, '/validate MOCK_VALIDATE_FAIL — must never pass')
    await executeRoot(page, tree, rootId)

    const refineTitle = await awaitNodeTitle(page, refineId, REFINE_FALLBACK_SUFFIX_RE, LLM_TIMEOUT)
    await expectValidateFailure(page, validateId)
  })

  test('nested refine — inner commands execute in each fork and descendant validate failure propagates', async ({
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

    const refineTitle = await awaitNodeTitle(page, refineId, REFINE_FALLBACK_SUFFIX_RE, LLM_TIMEOUT)
    await expectValidateFailure(page, validateId)
  })

  // ── Validate verdict ───────────────────────────────────────────────────────

  test('validate — pass verdict suffix written on the validate cell after parent post-processing', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat :n=2 List 3 colors')
    const validateId = await addChildCommand(page, tree, rootId, '/validate Each item must be a distinct color name')
    await executeRoot(page, tree, rootId)

    // The verdict suffix is WRITTEN (persisted) after post-processing, but under Firefox +
    // parallel-worker load the live node title occasionally never receives the final update
    // (an SSE/state-sync miss). Reload to read the persisted state — faithful to "written" —
    // then poll for the suffix rather than reading once.
    await page.reload()
    await awaitNodeTitle(page, validateId, VALIDATE_VERDICT_RE, LLM_TIMEOUT)
  })

  test('validate — exhaustion suffix [✗ N×] written when MOCK_VALIDATE_FAIL criterion always rejects', async ({ page }) => {
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

  test('foreach validate sequential — each iteration owns its own pass/fail verdict', async ({ page }) => {
    await assertForeachValidateContractFor(page, '/foreach /chat @@ --parallel=no')
  })

  test('foreach validate parallel — each iteration owns its own pass/fail verdict', async ({ page }) => {
    await assertForeachValidateContractFor(page, '/foreach /chat @@')
  })

  // ── UI state and persistence ───────────────────────────────────────────────

  test('executing visual state — abort button appears during execution and disappears on completion', async ({ page }) => {
    const { tree, detail, rootId } = await selectRootAndOpenDetail(page)
    await detail.fillCommand('/chat List 3 colors')
    // A single /chat under the mock backend keeps the root in executingNodeIds for only a
    // sub-second, optimistic-then-cleared window, which raced the transient abort button under
    // Firefox + parallel-worker load. A failing /validate with retries re-runs the parent
    // sequentially, holding the root "executing" for a reliably observable window.
    await addChildCommand(page, tree, rootId, '/validate MOCK_VALIDATE_FAIL — never passes :retry=2')
    await tree.selectNode(rootId)
    await detail.waitForComponent()

    // Arm the visibility waiter BEFORE triggering so the appearance can't be missed by an
    // assertion that only starts polling after the click resolves.
    const abortButton = page.getByTestId('abort-node-button')
    const abortAppeared = abortButton.waitFor({ state: 'visible', timeout: LLM_TIMEOUT })
    await detail.execute()
    await abortAppeared

    await abortButton.waitFor({ state: 'hidden', timeout: LLM_TIMEOUT })
    await expect(abortButton).not.toBeVisible()
  })

  test('reload persistence — full-success suffix and child count survive a full page reload', async ({ page }) => {
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

  test('commodity ceiling hint — shown for :n= commands, hidden for plain chat and /refine', async ({ page }) => {
    const { detail } = await selectRootAndOpenDetail(page)

    await detail.fillCommand('/chat :n=2 Say OK')
    await expect(page.getByTestId('commodity-ceiling-hint')).toBeVisible()

    await detail.fillCommand('/chat Say OK')
    await expect(page.getByTestId('commodity-ceiling-hint')).not.toBeVisible()

    await detail.fillCommand('/refine :n=2 Say OK')
    await expect(page.getByTestId('commodity-ceiling-hint')).not.toBeVisible()
  })

  test('executeAndWaitForCompletion — resolves correctly when called on a non-root node', async ({ page }) => {
    const tree = new WorkflowTreePage(page)
    const { rootId } = await selectRootAndOpenDetail(page)
    await tree.selectNode(rootId)
    const rootDetail = new NodeDetailPanelPage(page)
    await rootDetail.waitForComponent()
    await rootDetail.fillCommand('/chat :n=2 List 3 fruits')

    const refineId = await addChildCommand(page, tree, rootId, '/refine :n=2')
    await tree.selectNode(refineId)
    const refineDetail = new NodeDetailPanelPage(page)
    await refineDetail.waitForComponent()

    await executeAndWaitForCompletion(page, refineDetail)

    const refineTitle = await awaitNodeTitle(page, refineId, COMPLETION_SUFFIX_RE)
  })
})
