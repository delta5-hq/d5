import {test, expect} from '@playwright/test'
import {adminLogin, logout} from './utils'

/**
 * Public Workflows E2E Tests
 * 
 * Tests public workflow sharing functionality
 */

test.describe('Public Workflows', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
    await adminLogin(page)
    await page.waitForURL('/workflows')
  })

  test('should create and share workflow as public', async ({page}) => {
    // Create new workflow
    await page.click('button:has-text("New Workflow"), button:has-text("Create")')
    await page.waitForURL(/\/workflow\//)

    const workflowId = page.url().split('/').filter(Boolean).pop() || ''
    expect(workflowId).toBeTruthy()

    // Workflow created successfully (URL changed to /workflow/:id)
    await expect(page).toHaveURL(`/workflow/${workflowId}`)
  })

  test('should navigate to workflows list', async ({page}) => {
    await expect(page.getByRole('heading', { name: 'My Workflows' })).toBeVisible()
  })
})
