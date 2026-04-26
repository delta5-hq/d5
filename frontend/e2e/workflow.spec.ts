import { test, expect } from '@playwright/test'
import { adminLogin, logout, createWorkflow } from './utils'

const TEST_WORKFLOW_TITLE = 'E2E Test Workflow'
const CATEGORY_NAME = 'E2E Category'

test.describe('Workflow CRUD', () => {
  test('Create a new workflow', async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)

    const workflowId = await createWorkflow(page)

    await expect(page).toHaveURL(`/workflow/${workflowId}`)
  })

  test('View a workflow page', async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)

    const createdWorkflowId = await createWorkflow(page)

    await page.goto('/workflows')

    await page.waitForResponse(resp => resp.url().includes('/api/v2/workflow') && resp.status() === 200, {
      timeout: 10000,
    })

    await page.waitForTimeout(2000)

    await page.waitForSelector(`[data-workflow-id="${createdWorkflowId}"]`, { timeout: 15000 })

    await page.locator(`[data-workflow-id="${createdWorkflowId}"]`).click()

    await expect(page).toHaveURL(`/workflow/${createdWorkflowId}`)
  })

  test('List endpoint returns workflowId field for all workflows', async ({ page }) => {
    await page.goto('/workflows')
    await adminLogin(page)

    await createWorkflow(page)

    const response = await page.request.get('/api/v2/workflow?public=false')
    expect(response.ok()).toBeTruthy()

    const { data } = await response.json()
    expect(Array.isArray(data)).toBeTruthy()
    expect(data.length).toBeGreaterThan(0)

    data.forEach((workflow: any) => {
      expect(workflow).toHaveProperty('workflowId')
      expect(typeof workflow.workflowId).toBe('string')
      expect(workflow.workflowId.length).toBeGreaterThan(0)
    })
  })
})
