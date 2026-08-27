import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { LLM_TIMEOUT, TIMEOUTS } from './config/test-timeouts'
import { setupLLMWorkflow } from './reliability/workflow-lifecycle'
import { nodeTitle, selectRootAndOpenDetail, addChildCommand, executeRoot } from './reliability/node-interaction'

/*
 * note-9872 P0.4 — the `:limit=` cost ceiling must HARD-REFUSE a commodity/elect
 * fan-out when the projected fork cost exceeds the limit.
 *
 * Structure mirrors reliability-best-of-n.spec.ts ELECT_SUFFIX_CASES:
 *   root:   /chat :n=5 List 3 animals   → commodity scope of 5
 *   elect: /elect :n=5 :limit=xs      → 5 forks that re-run the parent scope
 *
 * :limit=xs resolves to a 20-execution budget (forkLimitParser TSHIRT xs → 20).
 *
 * projectForkCost = n × perForkScope, and perForkScope is measured from the LIVE tree, so the
 * projected number differs by surface — this is real, verified product behaviour, not a bug:
 *   • PRE-FLIGHT (Test 1, nothing executed): scope = readCommodityN(root '/chat :n=5') = 5,
 *     so cost = 5 × 5 = 25. Chip reads "…will be refused (25 calls)".
 *   • EXECUTE-TIME (Test 2): the refuse is projected inside postProcess, AFTER the root's own
 *     `:n=5` has already materialised 5 output nodes into the parent scope, so
 *     scope = 5 (root's own n) + 5 (its 5 output children ×1) = 10, and cost = 5 × 10 = 50.
 *     The error node reads "projected 50 executions exceeds limit 20".
 *
 * Refusal surfaces:
 *   PRE-FLIGHT  src/widgets/workflow/ui/node-detail-panel.tsx:245 data-testid="elect-cost-over-limit"
 *               (i18n workflowTree.node.electCostOverLimit, intl/en.ts:431 + intl/ru.ts:419), and the
 *               execute button disabled at :294 via canExecuteNode(cmd, electCostExceedsLimit).
 *   EXECUTE     backend resolveElectCell.js:65-70 → createErrorNode(forkLimitRefusalMessage(cost,limit))
 *               "projected N executions exceeds limit L" (backend string, not i18n → locale-neutral) and
 *               marks the elect cell with the appendInvalidSuffix "[✗ !]" (reliabilitySuffix.js:23);
 *               NO fork nodes are created.
 */

const ROOT_COMMAND = '/chat :n=5 List 3 animals'
const ELECT_COMMAND = '/elect :n=5 :limit=xs'

const LIMIT_XS = 20 // TSHIRT_TO_EXECUTIONS.xs
const PREFLIGHT_COST = 25 // n(5) × scope(5) — root + elect only, no fork outputs yet
const EXECUTE_TIME_COST = 50 // n(5) × scope(10) — scope now includes the root's 5 materialised :n=5 outputs

// forkLimitRefusalMessage(cost, limit) — backend-generated, identical in EN + RU (locale-neutral).
const REFUSAL_TEXT_RE = /projected (\d+) executions exceeds limit (\d+)/
// Chip cost is rendered as "(<n> calls)" / "(<n> вызовов)"; capture the leading number, locale-neutral.
const CHIP_COST_RE = /\((\d+)\s/
// "[✗ !]" is the invalid/refused marker; a judged fan-out would carry a "[✓ N/5]" winner suffix.
const REFUSED_SUFFIX_RE = /\[✗ !\]/
const FORK_WINNER_SUFFIX_RE = /\[✓ \d+\/5\]/

// Elect-scoped: count the elect cell's OWN direct children (NOT a whole-tree depth count — the
// root's allowed /chat :n=5 forks sit at the elect's own depth). Walk the flattened pre-order
// rows from the elect and count the contiguous run one level deeper.
async function electDirectChildCount(page: Page, electId: string): Promise<number> {
  return page.evaluate(rid => {
    const rows = Array.from(document.querySelectorAll('[data-node-id]')) as HTMLElement[]
    const idx = rows.findIndex(r => r.getAttribute('data-node-id') === rid)
    if (idx < 0) return -1
    const base = Number(rows[idx].getAttribute('data-node-depth'))
    let count = 0
    for (let i = idx + 1; i < rows.length; i++) {
      const d = Number(rows[i].getAttribute('data-node-depth'))
      if (d <= base) break // left the elect subtree
      if (d === base + 1) count++ // a direct child of the elect
    }
    return count
  }, electId)
}

async function buildOverLimitElectCell(page: Page) {
  const { tree, detail, rootId } = await selectRootAndOpenDetail(page)
  await detail.fillCommand(ROOT_COMMAND)
  const electId = await addChildCommand(page, tree, rootId, ELECT_COMMAND)
  // addChildCommand leaves the elect cell selected, so the detail panel now reflects it.
  return { tree, rootId, electId }
}

test.describe(':limit= fork-cost ceiling contracts', () => {
  test.setTimeout(LLM_TIMEOUT * 2)

  test.beforeEach(async ({ page }) => {
    await setupLLMWorkflow(page)
  })

  test('pre-flight refusal — over-:limit= elect surfaces the projected cost and disables execution before running', async ({
    page,
  }) => {
    const { tree } = await buildOverLimitElectCell(page)

    const overLimitChip = page.getByTestId('elect-cost-over-limit')
    await expect(overLimitChip).toBeVisible()
    await expect(overLimitChip).toContainText(':limit=')
    await expect(overLimitChip).toContainText('⛔')

    // The surfaced projected count is the pre-flight projection (25), before any fork output exists.
    const chipText = (await overLimitChip.textContent())?.trim() ?? ''
    expect(chipText).toMatch(CHIP_COST_RE)
    expect(chipText.match(CHIP_COST_RE)?.[1]).toBe(String(PREFLIGHT_COST))

    // Execution is hard-blocked pre-flight: the elect cell's execute button is disabled.
    await expect(page.getByTestId('execute-node-button')).toBeDisabled()

    // Nothing executed: only root + elect exist and no refusal error node has been written.
    await expect(tree.nodes).toHaveCount(2)
    await expect(page.locator('[data-node-id]', { hasText: /exceeds limit/ })).toHaveCount(0)
  })

  test('execute-time hard refuse — refusal error node carries cost+limit and ZERO fork nodes are created', async ({
    page,
  }) => {
    const { tree, rootId, electId } = await buildOverLimitElectCell(page)

    await executeRoot(page, tree, rootId)

    // On refusal the elect gains exactly one child (the error node); its expand toggle only
    // becomes visible once that child exists. Wait for it, then reveal the child if collapsed.
    const electToggle = tree.node(electId).getByTestId('node-toggle')
    await expect(electToggle).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })

    const refusal = page.locator('[data-node-id]', { hasText: /exceeds limit/ })
    if ((await refusal.count()) === 0) {
      await electToggle.click()
    }
    await expect(refusal).toHaveCount(1, { timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(refusal).toBeVisible()

    // The error node carries the execute-time projected cost (50) and the :limit=xs budget (20).
    const refusalText = (await refusal.first().textContent())?.trim() ?? ''
    expect(refusalText).toMatch(REFUSAL_TEXT_RE)
    const refusalMatch = refusalText.match(REFUSAL_TEXT_RE)
    expect(refusalMatch?.[1]).toBe(String(EXECUTE_TIME_COST))
    expect(refusalMatch?.[2]).toBe(String(LIMIT_XS))

    // The elect cell is marked refused ("[✗ !]") and is NOT a fork-winner ("[✓ N/5]") — proof
    // that resolveElectCell took the :limit= branch and never judged any fork.
    const electTitle = await nodeTitle(page, electId)
    expect(electTitle).toMatch(REFUSED_SUFFIX_RE)
    expect(electTitle).not.toMatch(FORK_WINNER_SUFFIX_RE)

    // ZERO fork nodes: the elect cell's ONLY direct child is the refusal error node. (The root's
    // five allowed /chat :n=5 forks are siblings of the elect, at the elect's own depth.)
    expect(await electDirectChildCount(page, electId)).toBe(1)
  })
})
