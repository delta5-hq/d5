import { expect, type Locator, type Page } from '@playwright/test'
import { TIMEOUTS } from '../config/test-timeouts'

export async function waitForElementWidth(page: Page, selector: string, timeout: number = TIMEOUTS.NAVIGATION): Promise<void> {
  await page.waitForFunction(
    (sel: string) => {
      const el = document.querySelector(sel)
      return el !== null && el.getBoundingClientRect().width > 0
    },
    selector,
    { timeout },
  )
}

export async function waitForLocatorLayoutBox(locator: Locator, timeout: number = TIMEOUTS.NAVIGATION): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout })

  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox({ timeout: 250 }).catch(() => null)
        return box !== null && box.width > 0 && box.height > 0
      },
      { timeout },
    )
    .toBe(true)
}
