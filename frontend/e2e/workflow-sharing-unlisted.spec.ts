import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowCardPage } from './page-objects/workflow-card.page'
import { ShareDialogInteractions } from './page-objects/share-dialog-interactions.page'
import { TIMEOUTS } from './config/test-timeouts'

test.describe('Workflow Sharing - Unlisted Mode Edge Cases', () => {
  let workflowId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await adminLogin(page)
    workflowId = await createWorkflow(page)
  })

  async function makeWorkflowUnlisted(page: any, workflowId: string) {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)
    await workflowCard.navigateToList()
    await workflowCard.clickShare()
    await dialog.setVisibilityMode('unlisted')
    await dialog.close()
  }

  test('unlisted workflow generates valid share link', async ({ page }) => {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await makeWorkflowUnlisted(page, workflowId)
    await workflowCard.openShareDialog()
    
    await expect(dialog.shareLinkInput).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    
    const shareLink = await dialog.getShareLink()
    
    expect(shareLink).toBeTruthy()
    expect(shareLink).toContain('http')
    expect(shareLink).toContain(workflowId)
  })

  test('unlisted workflow enables QR code generation', async ({ page }) => {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await makeWorkflowUnlisted(page, workflowId)
    await workflowCard.openShareDialog()
    
    await expect(dialog.qrToggle).toBeVisible({ timeout: TIMEOUTS.BACKEND_SYNC })
    
    const qrToggled = await dialog.toggleQRCode()
    expect(qrToggled).toBe(true)
    
    const qrVisible = await dialog.isQRCodeVisible()
    expect(qrVisible).toBe(true)
  })

  test('unlisted workflow does not appear in public workflows list', async ({ page }) => {
    await makeWorkflowUnlisted(page, workflowId)
    
    await page.goto('/workflows/public')
    await page.waitForLoadState('networkidle')

    const publicWorkflows = page.locator(`[data-workflow-id="${workflowId}"]`)
    await expect(publicWorkflows).toHaveCount(0)
  })

  test('unlisted collaborative toggle maintains independent memory', async ({ page }) => {
    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.openShareDialog()
    await dialog.setVisibilityMode('unlisted')
    
    await dialog.enableCollaborativeForMode('unlisted', true)
    const unlistedCollabState = await dialog.getCollaborativeStateForMode('unlisted')
    expect(unlistedCollabState).toBe(true)

    await dialog.setVisibilityMode('public')
    const publicCollabState = await dialog.getCollaborativeStateForMode('public')
    expect(publicCollabState).toBe(false)

    await dialog.setVisibilityMode('unlisted')
    const unlistedCollabStateAfter = await dialog.getCollaborativeStateForMode('unlisted')
    expect(unlistedCollabStateAfter).toBe(true)

    await dialog.close()
  })
})
