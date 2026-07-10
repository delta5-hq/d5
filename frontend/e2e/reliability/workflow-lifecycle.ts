import type { Page } from '@playwright/test'
import { qaBotLogin, createWorkflow } from '../utils'
import { TIMEOUTS } from '../config/test-timeouts'

export async function purgeQaBotWorkflows(page: Page): Promise<void> {
  /*
   * qa-bot has LimitWorkflows=10 (seeded by backend-v2/cmd/seed-users); without
   * this purge 10× test.beforeEach × 2 browsers saturates the cap and the next
   * POST /workflow returns 402 silently — waitForURL times out at 15s.
   * Retry loop: parallel workers share the same qa-bot account so the peer
   * browser can re-fill the quota between our GET and DELETE; loop until the
   * listing comes back empty (or we exhaust attempts).
   */
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

export async function setupLLMWorkflow(page: Page): Promise<void> {
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
