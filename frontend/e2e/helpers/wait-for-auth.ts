import type { Locator, Page } from '@playwright/test'
import { TIMEOUTS } from '../config/test-timeouts'

const USER_MENU_TRIGGER = '[data-testid="user-menu-trigger"]'
const LOGIN_CONTROL = '[data-type="login"]'
const REGISTER_LOGIN_LINK = 'span[data-type="login"]'

export async function waitForAuthenticatedState(page: Page, timeout: number = TIMEOUTS.NAVIGATION): Promise<void> {
  await page.locator(USER_MENU_TRIGGER).waitFor({ state: 'visible', timeout })
}

export async function waitForUnauthenticatedState(page: Page, timeout: number = TIMEOUTS.NAVIGATION): Promise<void> {
  await page.locator(LOGIN_CONTROL).waitFor({ state: 'visible', timeout })
}

export async function waitForRegisterPageReady(page: Page, timeout: number = TIMEOUTS.NAVIGATION): Promise<Locator> {
  const link = page.locator(REGISTER_LOGIN_LINK)
  await link.waitFor({ state: 'visible', timeout })
  return link
}
