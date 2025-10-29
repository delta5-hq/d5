import { test, expect } from '@playwright/test'
import { adminLogin, logout } from './utils'

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
    page.goto('/')

    await adminLogin(page)
    // Create workflow
    await page.goto('/workflows')
    await Promise.all([
      page.waitForURL(/\/workflow\//),
      page.getByRole('button', { name: /create.*workflow/i }).click(),
    ])

    const currentUrl = page.url()
    const workflowId = currentUrl.split('/').filter(Boolean).pop()

    if (!workflowId) {
      throw new Error(`Unable to extract workflowId from URL: ${currentUrl}`)
    }

    await logout(page)

    await page.goto(`/workflow/${workflowId}`)
    await expect(page).not.toHaveURL(`/workflow/${workflowId}`)
    await expect(page.locator('[data-type="login"]')).toBeVisible()
  })
})
