import type { Page } from '@playwright/test'
import { TIMEOUTS } from '../config/test-timeouts'

const USER_MENU_TRIGGER = '[data-testid="user-menu-trigger"]'

export async function waitForAuthenticatedState(page: Page, timeout = TIMEOUTS.NAVIGATION): Promise<void> {
  await page.locator(USER_MENU_TRIGGER).waitFor({ state: 'visible', timeout })
}

export async function waitForUnauthenticatedState(page: Page, timeout = TIMEOUTS.NAVIGATION): Promise<void> {
  await page.locator(USER_MENU_TRIGGER).waitFor({ state: 'hidden', timeout })
}
