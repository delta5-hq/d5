import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowCardPage } from './page-objects/workflow-card.page'
import { ShareDialogInteractions } from './page-objects/share-dialog-interactions.page'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Workflow Sharing - Browser-Specific Behaviors', () => {
  let workflowId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await adminLogin(page)
    workflowId = await createWorkflow(page)
  })

  async function makeWorkflowPublic(page: any, workflowId: string) {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)
    await workflowCard.navigateToList()
    await workflowCard.clickShare()
    await dialog.setVisibilityMode('public')
    await dialog.close()
  }

  test('clipboard API availability and fallback behavior', async ({ page, context, browserName }) => {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await makeWorkflowPublic(page, workflowId)
    await workflowCard.openShareDialog()
    
    await expect(dialog.shareLinkInput).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    
    const shareLink = await dialog.getShareLink()
    expect(shareLink).toBeTruthy()

    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      const clipboardText = await dialog.copyShareLinkToClipboard()
      expect(clipboardText).toBe(shareLink)
    } else {
      await expect(dialog.copyButton).toBeVisible()
      await dialog.copyButton.click()
    }

    await dialog.close()
  })
})
