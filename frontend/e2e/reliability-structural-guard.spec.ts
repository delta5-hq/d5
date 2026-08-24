import { test, expect } from '@playwright/test'
import { TIMEOUTS } from './config/test-timeouts'
import { setupLLMWorkflow } from './reliability/workflow-lifecycle'
import { nodeTitle, selectRootAndOpenDetail, executeRoot } from './reliability/node-interaction'

/*
 * note-9872 P0.1 — a fork-control command that requires a parent scope must be
 * STRUCTURALLY GUARDED when used standalone (no content cell above it), rather than
 * silently misfiring. /elect re-runs and judges its PARENT scope; with no parent there is
 * nothing to elect, so the engine writes a locale-neutral error node and marks the cell
 * refused "[✗ !]" — and NO fork nodes are created.
 *
 * User-visible refusal surface (execute-time):
 *   backend applyElect guard → createErrorNode("/elect requires a parent cell — it cannot
 *   be used as a standalone command"); the elect cell carries appendInvalidSuffix "[✗ !]".
 *   canExecuteNode('/elect …') is true (it IS a slash command), so the guard is reached on
 *   execute — it is not hidden behind a disabled button. This spec asserts the guard as it
 *   RENDERS in the workflow editor, mirroring the reliability-fork-limit execute-time surface.
 */

const GUARD_TEXT_RE = /requires a parent cell/
const REFUSED_SUFFIX_RE = /\[✗ !\]/
const FORK_WINNER_SUFFIX_RE = /\[✓ \d+\/\d+\]/

test.describe('structural guard — fork-control command used standalone', () => {
  test.beforeEach(async ({ page }) => {
    await setupLLMWorkflow(page)
  })

  test('bare /elect at the root surfaces a "requires a parent cell" error node and creates ZERO forks', async ({
    page,
  }) => {
    const { tree, detail, rootId } = await selectRootAndOpenDetail(page)
    // The root is the only cell — no content above it. A user typing /elect here has no
    // parent scope to elect, so the fork-control command is structurally invalid.
    await detail.fillCommand('/elect :n=2')

    await executeRoot(page, tree, rootId)

    // The guard renders as an error node child of the refused elect cell; its expand toggle
    // only becomes visible once that child exists. Reveal it if the root starts collapsed
    // (mirrors the :limit= execute-time refusal surface in reliability-fork-limit.spec.ts).
    const rootToggle = tree.node(rootId).getByTestId('node-toggle')
    await expect(rootToggle).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })

    const guard = page.locator('[data-node-id]', { hasText: GUARD_TEXT_RE })
    if ((await guard.count()) === 0) {
      await rootToggle.click()
    }
    await expect(guard).toHaveCount(1, { timeout: TIMEOUTS.BACKEND_SYNC })
    await expect(guard).toBeVisible()

    // The standalone elect cell is marked refused "[✗ !]" and never became a fork winner —
    // proof the engine took the structural-guard branch and never judged any fork.
    const rootTitle = await nodeTitle(page, rootId)
    expect(rootTitle).toMatch(REFUSED_SUFFIX_RE)
    expect(rootTitle).not.toMatch(FORK_WINNER_SUFFIX_RE)
  })
})
