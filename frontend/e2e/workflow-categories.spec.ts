import {test, expect} from '@playwright/test'
import {adminLogin} from './utils'

/**
 * Workflow Categories E2E Tests
 * 
 * Tests workflow categorization (future feature)
 */

test.describe('Workflow Categories', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/')
    await adminLogin(page)
    await page.waitForURL('/workflows')
  })

  test('should display workflows page', async ({page}) => {
    await expect(page.getByRole('heading', { name: 'My Workflows' })).toBeVisible()
  })

  test('should create new workflow for future categorization', async ({page}) => {
    await page.click('button:has-text("New Workflow"), button:has-text("Create")')
    await page.waitForURL(/\/workflow\//)

    const workflowId = page.url().split('/').filter(Boolean).pop() || ''
    expect(workflowId).toBeTruthy()
  })
})
