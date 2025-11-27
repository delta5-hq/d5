import { test, expect } from '@playwright/test'
import { adminLogin, logout } from './utils'

const TEST_WORKFLOW_TITLE = 'E2E Test Workflow'
const CATEGORY_NAME = 'E2E Category'

test.describe('Workflow CRUD', () => {
  test('Create a new workflow', async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)

    await Promise.all([
      page.waitForURL(/\/workflow\//),
      page.getByRole('button', { name: /create.*workflow/i }).click(),
    ])

    const currentUrl = page.url()
    const workflowId = currentUrl.split('/').filter(Boolean).pop()

    await expect(page).toHaveURL(`/workflow/${workflowId}`)
  })

  test('View a workflow page', async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)

    // Create a workflow first
    await page.goto('/workflows')
    await Promise.all([
      page.waitForURL(/\/workflow\//),
      page.getByRole('button', { name: /create.*workflow/i }).click(),
    ])

    const createdUrl = page.url()
    const createdWorkflowId = createdUrl.split('/').filter(Boolean).pop()

    if (!createdWorkflowId) {
      throw new Error(`Unable to extract workflowId from URL: ${createdUrl}`)
    }

    // Navigate back to workflows list
    await page.goto('/workflows')
    
    // Wait for backend API response confirming workflows loaded
    await page.waitForResponse(
      resp => resp.url().includes('/api/v2/workflow') && resp.status() === 200,
      { timeout: 10000 }
    )
    
    // Wait additional time for UI to render workflow cards
    await page.waitForTimeout(2000)
    
    // Wait for the specific workflow to appear in DOM
    await page.waitForSelector(`[data-key="${createdWorkflowId}"]`, { timeout: 15000 })
    
    // Click on the created workflow
    await page.locator(`[data-key="${createdWorkflowId}"]`).click()

    await expect(page).toHaveURL(`/workflow/${createdWorkflowId}`)
  })
})
