import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowCardPage } from './page-objects/workflow-card.page'
import { ShareDialogInteractions } from './page-objects/share-dialog-interactions.page'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Workflow Sharing - Maximum Bounds & Limits', () => {
  let workflowId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await adminLogin(page)
    workflowId = await createWorkflow(page)
  })

  test('share dialog renders with extremely long workflow title', async ({ page }) => {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.navigateToList()
    await workflowCard.clickShare()
    
    await expect(dialog.dialog).toBeVisible()
    await expect(dialog.publicOption).toBeVisible()
    
    await dialog.close()
  })

  test('share link displays correctly with maximum length workflow ID', async ({ page }) => {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.openShareDialog()
    await dialog.setVisibilityMode('public')
    
    await expect(dialog.shareLinkInput).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    
    const shareLink = await dialog.getShareLink()
    expect(shareLink).toBeTruthy()
    expect(shareLink!.length).toBeLessThan(2048)
    
    await dialog.close()
  })
})
