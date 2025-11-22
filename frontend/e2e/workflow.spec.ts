import { test, expect } from '@playwright/test'
import { adminLogin, logout } from './utils'

const TEST_WORKFLOW_TITLE = 'E2E Test Workflow'
const CATEGORY_NAME = 'E2E Category'

let createdWorkflowId = ''

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto('/')

  await adminLogin(page)
  // Create workflow
  await page.goto('/workflows')
  await Promise.all([page.waitForURL(/\/workflow\//), page.getByRole('button', { name: /create.*workflow/i }).click()])

  const currentUrl = page.url()
  const workflowId = currentUrl.split('/').filter(Boolean).pop()

  if (!workflowId) {
    throw new Error(`Unable to extract workflowId from URL: ${currentUrl}`)
  }

  createdWorkflowId = workflowId

  await logout(page)
  await page.close()
})

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

    await page.goto('/workflows')
    await page.locator(`[data-key="${createdWorkflowId}"]`).click()

    await expect(page).toHaveURL(`/workflow/${createdWorkflowId}`)
  })
})
