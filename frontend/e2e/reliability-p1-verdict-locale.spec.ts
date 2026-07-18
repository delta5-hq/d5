import { test, expect } from '@playwright/test'
import { WorkflowTreePage, NodeDetailPanelPage } from './page-objects'
import { TIMEOUTS } from './config/test-timeouts'
import { COMPLETION_SUFFIX_RE } from './reliability/suffix-patterns'
import { setupLLMWorkflow } from './reliability/workflow-lifecycle'
import {
  awaitNodeTitle,
  selectRootAndOpenDetail,
  addChildCommand,
  executeRoot,
} from './reliability/node-interaction'

// Live qa-bot probe for P1.4 (per-criterion verdict drawer), P1.5 (RU/EN locale of the
// new reliability labels) and P1.6 (judge-quality warning surfaces). No existing browser
// spec closes these; this exercises the real rendered UI end-to-end.
test.describe('P1.4/P1.5/P1.6 — verdict drawer, locale, judge-quality (live)', () => {
  test('verdict drawer opens from the cell suffix, renders per-criterion verdict, and localizes EN->RU', async ({ page }) => {
    await setupLLMWorkflow(page)
    const tree = new WorkflowTreePage(page)
    const { detail, rootId } = await selectRootAndOpenDetail(page)

    // Root must be a content cell for /refine to attach (else "/refine requires a parent cell").
    await detail.fillCommand('/chat :n=2 Write one short friendly greeting')
    const refineId = await addChildCommand(page, tree, rootId, '/refine :n=2')
    const validateId = await addChildCommand(page, tree, refineId, '/validate answer is non-empty')

    await executeRoot(page, tree, rootId)
    await awaitNodeTitle(page, refineId, COMPLETION_SUFFIX_RE)

    // perCriterionVerdict / verdict-button may live on the refine or the validate cell — find it.
    let carrier = refineId
    await tree.selectNode(refineId)
    await detail.waitForComponent()
    if (!(await page.getByTestId('verdict-button').isVisible().catch(() => false))) {
      carrier = validateId
      await tree.selectNode(validateId)
      await detail.waitForComponent()
    }
    console.log('P1.4 verdict-button carrier node:', carrier === refineId ? 'refine' : 'validate')

    // P1.6 (pre-execute surface): log whether a judge-quality pre-execute warning renders on the refine cell.
    const preWarn = page.getByTestId('pre-execute-warnings')
    console.log('P1.6 pre-execute-warnings visible:', await preWarn.isVisible().catch(() => false))
    if (await preWarn.isVisible().catch(() => false)) {
      console.log('P1.6 pre-execute text:', (await preWarn.innerText()).replace(/\n/g, ' | ').slice(0, 300))
    }

    // P1.4: the verdict-button appears only when perCriterionVerdict exists; click opens the drawer.
    const verdictButton = page.getByTestId('verdict-button')
    await expect(verdictButton, 'P1.4: verdict-button should appear on a cell carrying perCriterionVerdict').toBeVisible({
      timeout: TIMEOUTS.medium,
    })
    // P1.5 (EN): the new reliability label renders in English.
    await expect(verdictButton, 'P1.5: verdict button label is English by default').toHaveText(/View verdict/i)

    await verdictButton.click()
    const drawer = page.getByTestId('criterion-verdict-drawer')
    await expect(drawer, 'P1.4: criterion-verdict-drawer opens').toBeVisible()
    const drawerText = (await drawer.innerText()).replace(/\n/g, ' | ')
    console.log('P1.4 drawer text:', drawerText.slice(0, 600))

    // P1.6 (post-execute surface): judge-quality-warnings section is present when warnings exist.
    const jqw = drawer.getByTestId('judge-quality-warnings')
    console.log('P1.6 judge-quality-warnings visible in drawer:', await jqw.isVisible().catch(() => false))
    if (await jqw.isVisible().catch(() => false)) {
      console.log('P1.6 judge-quality text:', (await jqw.innerText()).replace(/\n/g, ' | ').slice(0, 300))
    }

    // P1.5 (RU): switch stored locale, reload the same workflow, assert the label flips to Russian.
    const url = page.url()
    await page.evaluate(() => localStorage.setItem('d5-locale', 'ru'))
    await page.goto(url)
    await tree.selectNode(refineId)
    await new NodeDetailPanelPage(page).waitForComponent()
    await expect(
      page.getByTestId('verdict-button'),
      'P1.5: the same label renders in Russian after locale switch',
    ).toHaveText(/Показать вердикт/i)
  })
})
