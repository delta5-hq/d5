import { test, expect } from '@playwright/test'
import { adminLogin, logout, createWorkflow } from './utils'

test.describe('Unauthenticated Guards', () => {
  test('redirects unauthenticated user from /workflows to registration prompt', async ({ page }) => {
    await page.goto('/workflows')
    await expect(page.locator('[data-type="login"]')).toBeVisible()
  })

  test('allows unauthenticated access to /workflows/public', async ({ page }) => {
    await page.goto('/workflows/public')
    await expect(page).toHaveURL(/\/workflows\/public$/)
  })

  test('redirects unauthenticated user away from /settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).not.toHaveURL('/settings')
    await expect(page.locator('[data-type="login"]')).toBeVisible()
  })

  test('redirects unauthenticated user away from workflow page', async ({ page }) => {
    // Use the workflow created in beforeAll
    await page.goto('/')

    await adminLogin(page)
    // Create workflow
    const workflowId = await createWorkflow(page)

    await logout(page)

    await page.goto(`/workflow/${workflowId}`)
    await expect(page).not.toHaveURL(`/workflow/${workflowId}`)
    await expect(page.locator('[data-type="login"]')).toBeVisible()
  })
})
