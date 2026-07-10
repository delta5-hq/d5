import type { Page } from '@playwright/test'
import { LLM_TIMEOUT, TIMEOUTS } from '../config/test-timeouts'

const abortButton = (page: Page) => page.getByTestId('abort-node-button')

export async function awaitExecutionStarted(page: Page): Promise<void> {
  await abortButton(page).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC })
}

export async function awaitExecutionCompleted(page: Page): Promise<void> {
  // Visible gate is best-effort: a fast-completing execution may already be
  // hidden before Playwright polls. The hidden gate is the authoritative
  // completion contract; swallow a visible-timeout and let hidden decide.
  await abortButton(page).waitFor({ state: 'visible', timeout: TIMEOUTS.BACKEND_SYNC }).catch(() => {})
  await abortButton(page).waitFor({ state: 'hidden', timeout: LLM_TIMEOUT })
}
