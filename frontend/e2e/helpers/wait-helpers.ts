import type { Page } from '@playwright/test'

export interface WaitOptions {
  timeout?: number
  state?: 'visible' | 'hidden' | 'attached' | 'detached'
}

export const DEFAULT_WAIT_TIMEOUT = 5000
export const DEFAULT_NAVIGATION_TIMEOUT = 10000
export const DEFAULT_ANIMATION_DELAY = 300

export async function waitForElement(
  page: Page,
  selector: string,
  options: WaitOptions = {}
): Promise<void> {
  const { timeout = DEFAULT_WAIT_TIMEOUT, state = 'visible' } = options
  await page.locator(selector).waitFor({ state, timeout })
}

export async function waitForNavigation(page: Page, urlPattern: string | RegExp, timeout?: number): Promise<void> {
  await page.waitForURL(urlPattern, { timeout: timeout ?? DEFAULT_NAVIGATION_TIMEOUT })
}

export async function waitForTransition(page: Page, delay: number = DEFAULT_ANIMATION_DELAY): Promise<void> {
  await page.waitForTimeout(delay)
}

export async function safeClick(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector)
  await element.waitFor({ state: 'visible', timeout: DEFAULT_WAIT_TIMEOUT })
  await element.click()
}

export async function safeFill(page: Page, selector: string, value: string): Promise<void> {
  const element = page.locator(selector)
  await element.waitFor({ state: 'visible', timeout: DEFAULT_WAIT_TIMEOUT })
  await element.fill(value)
}

/**
 * Selects a workflow scope in the workflow scope selector dropdown.
 * This function is idempotent - calling it multiple times with the same
 * workflowId is safe and will not hang.
 *
 * Response listener is registered before clicking to prevent race conditions
 * where the response arrives before the listener is ready.
 */
export async function selectWorkflowScope(
  page: Page,
  workflowId: string,
  timeout: number = DEFAULT_NAVIGATION_TIMEOUT
): Promise<void> {
  const selector = page.locator('[data-type="workflow-scope-selector"]')
  await selector.click()

  const targetItem = page.locator(`[data-type="scope-workflow-${workflowId}"]`)
  const currentState = await targetItem.getAttribute('data-state')

  if (currentState === 'checked') {
    await page.keyboard.press('Escape')
    return
  }

  const scopedResponsePromise = page.waitForResponse(
    resp =>
      resp.url().includes(`workflowId=${workflowId}`) &&
      resp.request().method() === 'GET' &&
      resp.ok(),
    { timeout }
  )

  await targetItem.click()
  await scopedResponsePromise
}
