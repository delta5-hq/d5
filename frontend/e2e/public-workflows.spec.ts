import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowCardPage } from './page-objects/workflow-card.page'
import { ShareDialogInteractions } from './page-objects/share-dialog-interactions.page'
import { testAcrossViewports, STANDARD_VIEWPORTS } from './helpers/viewport-testing'

test.describe('Public Workflows', () => {
  test.describe('Workflow creation and sharing', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await adminLogin(page)
      await page.waitForURL('/workflows')
    })

    test('should create and share workflow as public', async ({ page }) => {
      // Create workflow
      const workflowId = await createWorkflow(page)
      expect(workflowId).toBeTruthy()
      await expect(page).toHaveURL(`/workflow/${workflowId}`)

      // Navigate to workflows list and share
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.navigateToList()
      await workflowCard.clickShare()

      // Verify share dialog opens with default private state
      await expect(dialog.dialog).toBeVisible()
      await expect(dialog.privateOption).toBeChecked()

      // Change to public
      await dialog.publicOption.click()
      await expect(dialog.publicOption).toBeChecked({ timeout: 15000 })
      await dialog.waitForPersistence()
      await dialog.close()

      // Verify persistence
      await workflowCard.clickShare()
      await expect(dialog.publicOption).toBeChecked()
      await dialog.close()
    })

    test('should navigate to workflows list', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'My Workflows' })).toBeVisible()
    })

    test('public workflow appears on public workflows page', async ({ page }) => {
      // Create and publish workflow
      const workflowId = await createWorkflow(page)
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await dialog.publicOption.click()
      await expect(dialog.publicOption).toBeChecked({ timeout: 15000 })
      await dialog.waitForPersistence()
      await dialog.close()

      // Navigate to public workflows page
      await page.goto('/workflows/public')
      await page.waitForLoadState('networkidle')

      // Verify workflow is visible on public page
      const publicWorkflowCard = page.locator(`[data-workflow-id="${workflowId}"]`)
      await expect(publicWorkflowCard).toBeVisible({ timeout: 10000 })
    })

    test('private workflow does not appear on public workflows page', async ({ page }) => {
      // Create workflow (defaults to private)
      const workflowId = await createWorkflow(page)
      
      // Navigate to public workflows page
      await page.goto('/workflows/public')
      await page.waitForLoadState('networkidle')

      // Verify workflow is NOT visible on public page
      const publicWorkflowCard = page.locator(`[data-workflow-id="${workflowId}"]`)
      await expect(publicWorkflowCard).toHaveCount(0)
    })
  })

  test.describe('Unauthenticated access', () => {
    test('unauthenticated user can access public workflows page', async ({ page }) => {
      await page.goto('/workflows/public')
      
      // Should not redirect to registration
      await expect(page).toHaveURL('/workflows/public')
      
      // Page should load without errors
      await page.waitForLoadState('networkidle')
    })

    test('unauthenticated user cannot see share buttons on public workflows', async ({ page }) => {
      await page.goto('/workflows/public')
      await page.waitForLoadState('networkidle')

      // Share buttons should not be visible for unauthenticated users
      const shareButtons = page.getByTestId('workflow-share-button')
      await expect(shareButtons).toHaveCount(0)
    })
  })
})

testAcrossViewports(
  'Public workflows page responsive behavior',
  async (page, viewport) => {
    await page.goto('/workflows/public')
    await page.waitForLoadState('networkidle')

    // Page should load and be functional on all viewports
    await expect(page).toHaveURL('/workflows/public')
    
    // Heading should be visible (may differ on mobile)
    const heading = page.getByRole('heading', { name: /workflows|public/i }).first()
    await expect(heading).toBeVisible()
  },
  STANDARD_VIEWPORTS
)

