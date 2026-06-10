import type { Page } from '@playwright/test'
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
