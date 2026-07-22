import type { Page } from '@playwright/test'

const ADD_MCP = '[data-type="add-mcp"]'
const ADD_RPC = '[data-type="add-rpc"]'

const DEFAULT_TIMEOUT_MS = 45000

export async function waitForIntegrationCategoryReady(
  page: Page,
  timeout: number = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  await Promise.all([
    page.locator(ADD_MCP).waitFor({ state: 'visible', timeout }),
    page.locator(ADD_RPC).waitFor({ state: 'visible', timeout }),
  ])
}
