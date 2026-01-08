import { test, expect } from '@playwright/test'
import { adminLogin, logout, createWorkflow, clearAuthState } from './utils'

test.describe('Unauthenticated Guards', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page)
  })

  test('redirects unauthenticated user from /workflows to registration prompt', async ({ page }) => {
    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-type="login"]')).toBeVisible({ timeout: 15000 })
  })

  test('allows unauthenticated access to /workflows/public', async ({ page }) => {
    await page.goto('/workflows/public')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/workflows\/public$/)
  })

  test('redirects unauthenticated user away from /settings', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL('/settings')
    await expect(page.locator('[data-type="login"]')).toBeVisible({ timeout: 15000 })
  })

  test('redirects unauthenticated user away from workflow page', async ({ page }) => {
    // Use the workflow created in beforeAll
    await page.goto('/')

    await adminLogin(page)
    // Create workflow
    const workflowId = await createWorkflow(page)

    await logout(page)
    await clearAuthState(page)

    await page.goto(`/workflow/${workflowId}`)
    await page.waitForLoadState('networkidle')
    await expect(page).not.toHaveURL(`/workflow/${workflowId}`)
    await expect(page.locator('[data-type="login"]')).toBeVisible({ timeout: 15000 })
  })
})
