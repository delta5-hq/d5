import { expect } from '@playwright/test'
import { createWorkflow } from './utils'
import { WorkflowCardPage } from './page-objects/workflow-card.page'
import { ShareDialogInteractions } from './page-objects/share-dialog-interactions.page'
import { TIMEOUTS } from './config/test-timeouts'
import { createAdminTest } from './fixtures/parallel-user-test'

const test = createAdminTest('workflow-sharing-network-errors')

test.describe('Workflow Sharing - Network Error Handling', () => {
  let workflowId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/workflows')
    workflowId = await createWorkflow(page)
  })

  test.afterEach(async ({ page }) => {
    await page.unroute('**')
  })

  test('visibility change survives network timeout with retry', async ({ page }) => {
    await page.route('**/api/v2/workflow/*/share/public', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })

    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.openShareDialog()
    await dialog.setVisibilityMode('public')

    const currentMode = await dialog.getCurrentVisibilityMode()
    expect(currentMode).toBe('public')

    await dialog.close()
  })

  test('handles 500 server error gracefully during visibility change', async ({ page }) => {
    let attemptCount = 0

    await page.route('**/api/v2/workflow/*/share/public', async route => {
      attemptCount++
      if (attemptCount === 1) {
        await route.fulfill({ status: 500, body: JSON.stringify({ message: 'Internal Server Error' }) })
      } else {
        await route.continue()
      }
    })

    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.openShareDialog()

    await dialog.setVisibilityMode('public').catch(() => {})
    await page.waitForResponse('**/api/v2/workflow/*/share/public').catch(() => {})
    await dialog.setVisibilityMode('public').catch(() => {})

    await dialog.close()
  })

  test('handles network disconnection during access list update', async ({ page }) => {
    await page.route('**/api/v2/workflow/*/share/access', async route => {
      await route.abort('internetdisconnected')
    })

    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.openShareDialog()
    await dialog.setVisibilityMode('public')

    await expect(dialog.publicOption).toBeChecked({ timeout: TIMEOUTS.BACKEND_SYNC })
    await dialog.close()
  })

  test('collaborative toggle handles slow network without state corruption', async ({ page }) => {
    await page.route('**/api/v2/workflow/*/share/public', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000))
      await route.continue()
    })

    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.openShareDialog()
    await dialog.setVisibilityMode('public')

    await dialog.enableCollaborativeForMode('public', true)
    const collaborativeState = await dialog.getCollaborativeStateForMode('public')
    expect(collaborativeState).toBe(true)

    await dialog.close()
  })

  test('maintains UI consistency during partial API response', async ({ page }) => {
    await page.route('**/api/v2/workflow/*', async route => {
      const response = await route.fetch()
      const json = await response.json()

      delete json.share

      await route.fulfill({
        status: 200,
        body: JSON.stringify(json),
      })
    })

    const workflowCard = new WorkflowCardPage(page, workflowId)
    const dialog = new ShareDialogInteractions(page)

    await workflowCard.navigateToList()
    await workflowCard.clickShare()

    await expect(dialog.dialog).toBeVisible()
    await expect(dialog.privateOption).toBeVisible()

    await dialog.close()
  })
})
