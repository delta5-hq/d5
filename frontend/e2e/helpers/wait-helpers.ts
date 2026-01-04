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
