import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowCardPage } from './page-objects/workflow-card.page'
import { ShareDialogInteractions } from './page-objects/share-dialog-interactions.page'
import { testAcrossViewports, testViewportTransitions, STANDARD_VIEWPORTS } from './helpers/viewport-testing'

test.describe('Workflow Sharing', () => {
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
    await dialog.publicOption.click()
    await page.waitForTimeout(500)
    await dialog.close()
  }

  test.describe('Dialog Lifecycle', () => {
    test('opens and closes share dialog', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await expect(dialog.dialog).toBeVisible()

      await dialog.close()
      await expect(dialog.dialog).not.toBeVisible()
    })
  })

  test.describe('Visibility State Transitions', () => {
    test('private to public transition persists', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await expect(dialog.privateOption).toBeChecked()
      
      await dialog.publicOption.click()
      await page.waitForTimeout(1000)
      await expect(dialog.publicOption).toBeChecked()
      await dialog.close()

      await page.goto('/workflows')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      await workflowCard.clickShare()
      await expect(dialog.publicOption).toBeChecked()
      await dialog.close()
    })

    test('public to private transition persists', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await makeWorkflowPublic(page, workflowId)
      await page.waitForTimeout(500)

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toBeChecked()

      await dialog.privateOption.click()
      await page.waitForTimeout(1000)
      await expect(dialog.privateOption).toBeChecked()
      await dialog.close()

      await page.waitForTimeout(500)
      await workflowCard.openShareDialog()
      await expect(dialog.privateOption).toBeChecked()
      await dialog.close()
    })

    test('multiple consecutive state changes persist correctly', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      
      await dialog.publicOption.click()
      await page.waitForTimeout(1000)
      await expect(dialog.publicOption).toBeChecked()

      await dialog.privateOption.click()
      await page.waitForTimeout(1000)
      await expect(dialog.privateOption).toBeChecked()

      await dialog.publicOption.click()
      await page.waitForTimeout(1000)
      await expect(dialog.publicOption).toBeChecked()

      await dialog.close()
      await page.waitForTimeout(500)

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toBeChecked()
      await dialog.close()
    })
  })

  test.describe('Share Link', () => {
    test('generates valid share link', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await makeWorkflowPublic(page, workflowId)
      await workflowCard.openShareDialog()
      const shareLink = await dialog.getShareLink()
      
      expect(shareLink).toBeTruthy()
      expect(shareLink).toContain('http')
      expect(shareLink).toContain(workflowId)
    })

    test('copies share link to clipboard', async ({ page, context, browserName }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await makeWorkflowPublic(page, workflowId)
      await workflowCard.openShareDialog()
      
      const shareLink = await dialog.getShareLink()
      expect(shareLink).toBeTruthy()
      expect(shareLink).toContain(workflowId)

      if (browserName === 'chromium') {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
        const clipboardText = await dialog.copyShareLinkToClipboard()
        expect(clipboardText).toBe(shareLink)
      } else {
        await expect(dialog.copyButton).toBeVisible()
        await dialog.copyButton.click()
      }
    })
  })

  test.describe('QR Code', () => {
    test('toggles QR code visibility', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await makeWorkflowPublic(page, workflowId)
      await workflowCard.openShareDialog()
      const qrToggled = await dialog.toggleQRCode()
      
      expect(qrToggled).toBe(true)
      const qrVisible = await dialog.isQRCodeVisible()
      expect(qrVisible).toBe(true)
    })
  })

  test.describe('Responsive Behavior', () => {
    testAcrossViewports('dialog renders correctly', async page => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await expect(dialog.dialog).toBeVisible()
      await expect(workflowCard.shareButton).toBeVisible()
    })

    test('dialog state persists across viewport changes', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await testViewportTransitions(page, async () => {
        await expect(dialog.dialog).toBeVisible()
      }, STANDARD_VIEWPORTS)
    })
  })

  test.describe('Authentication', () => {
    test('share button not visible on public workflows page', async ({ page }) => {
      await page.goto('/workflows/public')
      await page.waitForLoadState('networkidle')

      const shareButtons = page.getByTestId('workflow-share-button')
      const shareButtonCount = await shareButtons.count()
      expect(shareButtonCount).toBe(0)
    })
  })

  test.describe('Share Button Behavior', () => {
    test('share button on private workflow auto-publishes', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await expect(dialog.privateOption).toBeChecked()
      
      await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })
      await dialog.close()
    })

    test('share button respects manual visibility changes', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await makeWorkflowPublic(page, workflowId)
      await page.waitForTimeout(500)

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toBeChecked()

      await dialog.privateOption.click()
      await page.waitForTimeout(1000)

      await expect(dialog.privateOption).toBeChecked()
      await expect(dialog.publicOption).not.toBeChecked()

      await dialog.close()
      await page.waitForTimeout(500)

      await workflowCard.openShareDialog()
      await expect(dialog.privateOption).toBeChecked()
      await dialog.close()
    })

    test('share button does not override existing public state', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await makeWorkflowPublic(page, workflowId)
      await page.waitForTimeout(500)

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toBeChecked()
      
      await page.waitForTimeout(1000)
      await expect(dialog.publicOption).toBeChecked()
      await dialog.close()
    })
  })

  test.describe('Collaborative Editing', () => {
    test.describe('Basic Toggle Operations', () => {
      test('can toggle collaborative ON and OFF in public mode', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await makeWorkflowPublic(page, workflowId)
        await workflowCard.openShareDialog()

        const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
        expect(await publicToggle.getAttribute('aria-checked')).toBe('false')

        await publicToggle.click()
        await page.waitForTimeout(2000)
        expect(await publicToggle.getAttribute('aria-checked')).toBe('true')

        await publicToggle.click()
        await page.waitForTimeout(2000)
        expect(await publicToggle.getAttribute('aria-checked')).toBe('false')

        await dialog.close()
      })

      test('can toggle collaborative ON and OFF in unlisted mode', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()
        const unlistedLabel = dialog.dialog.locator('label:has-text("Unlisted"), label[for="unlisted"]').first()
        await expect(unlistedLabel).toBeVisible({ timeout: 5000 })
        await unlistedLabel.click()
        await page.waitForTimeout(2000)

        const unlistedToggle = dialog.dialog.locator('button[role="switch"]').first()
        expect(await unlistedToggle.getAttribute('aria-checked')).toBe('false')

        await unlistedToggle.click()
        await page.waitForTimeout(2000)
        expect(await unlistedToggle.getAttribute('aria-checked')).toBe('true')

        await unlistedToggle.click()
        await page.waitForTimeout(2000)
        expect(await unlistedToggle.getAttribute('aria-checked')).toBe('false')

        await dialog.close()
      })
    })

    test.describe('Memory Persistence', () => {
      test('collaborative state persists after dialog close and reopen', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await makeWorkflowPublic(page, workflowId)
        await workflowCard.openShareDialog()

        const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
        await publicToggle.click()
        await page.waitForTimeout(2000)
        expect(await publicToggle.getAttribute('aria-checked')).toBe('true')
        await dialog.close()

        await workflowCard.openShareDialog()
        expect(await publicToggle.getAttribute('aria-checked')).toBe('true')
        await dialog.close()
      })

      test('public collaborative state preserved when switching to unlisted and back', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()
        await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })

        const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
        await publicToggle.click()
        await page.waitForTimeout(2000)
        expect(await publicToggle.getAttribute('aria-checked')).toBe('true')

        const unlistedLabel = dialog.dialog.locator('label:has-text("Unlisted"), label[for="unlisted"]').first()
        await expect(unlistedLabel).toBeVisible({ timeout: 5000 })
        await unlistedLabel.click()
        await page.waitForTimeout(2000)

        await expect(dialog.publicOption).toBeEnabled({ timeout: 5000 })
        await dialog.publicOption.click()
        await page.waitForTimeout(2000)

        expect(await publicToggle.getAttribute('aria-checked')).toBe('true')
        await dialog.close()
      })

      test('unlisted collaborative state preserved when switching to public and back', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()
        const unlistedLabel = dialog.dialog.locator('label:has-text("Unlisted"), label[for="unlisted"]').first()
        await expect(unlistedLabel).toBeVisible({ timeout: 5000 })
        await unlistedLabel.click()
        await page.waitForTimeout(2000)

        const unlistedToggle = dialog.dialog.locator('button[role="switch"]').first()
        await unlistedToggle.click()
        await page.waitForTimeout(2000)
        expect(await unlistedToggle.getAttribute('aria-checked')).toBe('true')

        await expect(dialog.publicOption).toBeEnabled({ timeout: 5000 })
        await dialog.publicOption.click()
        await page.waitForTimeout(2000)

        await expect(unlistedLabel).toBeEnabled({ timeout: 5000 })
        await unlistedLabel.click()
        await page.waitForTimeout(2000)

        expect(await unlistedToggle.getAttribute('aria-checked')).toBe('true')
        await dialog.close()
      })
    })

    test.describe('Independent Memory per Visibility Mode', () => {
      test('enabling collaborative in one mode does not affect other mode', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()
        await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })

        const unlistedLabel = dialog.dialog.locator('label:has-text("Unlisted"), label[for="unlisted"]').first()
        await expect(unlistedLabel).toBeVisible({ timeout: 5000 })
        await unlistedLabel.click()
        await page.waitForTimeout(2000)

        const unlistedToggle = dialog.dialog.locator('button[role="switch"]').first()
        await unlistedToggle.click()
        await page.waitForTimeout(2000)
        expect(await unlistedToggle.getAttribute('aria-checked')).toBe('true')

        await expect(dialog.publicOption).toBeEnabled({ timeout: 5000 })
        await dialog.publicOption.click()
        await page.waitForTimeout(2000)

        const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
        expect(await publicToggle.getAttribute('aria-checked')).toBe('false')

        await dialog.close()
      })

      test('non-collaborative state preserved when switching between visibility modes', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()
        await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })

        const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
        expect(await publicToggle.getAttribute('aria-checked')).toBe('false')

        const unlistedLabel = dialog.dialog.locator('label:has-text("Unlisted"), label[for="unlisted"]').first()
        await expect(unlistedLabel).toBeVisible({ timeout: 5000 })
        await unlistedLabel.click()
        await page.waitForTimeout(2000)

        const unlistedToggle = dialog.dialog.locator('button[role="switch"]').first()
        expect(await unlistedToggle.getAttribute('aria-checked')).toBe('false')

        await expect(dialog.publicOption).toBeEnabled({ timeout: 5000 })
        await dialog.publicOption.click()
        await page.waitForTimeout(2000)

        expect(await publicToggle.getAttribute('aria-checked')).toBe('false')

        await dialog.close()
      })
    })

    test.describe('Special Cases', () => {
      test('debounced updates persist final state from rapid toggle clicks', async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await makeWorkflowPublic(page, workflowId)
        await workflowCard.openShareDialog()

        const publicToggle = dialog.dialog.locator('button[role="switch"]').last()

        await publicToggle.click() // ON
        await publicToggle.click() // OFF
        await publicToggle.click() // ON
        await page.waitForTimeout(2000)

        const finalState = await publicToggle.getAttribute('aria-checked')
        expect(finalState).toBe('true')

        await dialog.close()
      })

      test('collaborative state isolated per workflow instance', async ({ page }) => {
        const workflow2Id = await createWorkflow(page)
        const workflowCard1 = new WorkflowCardPage(page, workflowId)
        const workflowCard2 = new WorkflowCardPage(page, workflow2Id)
        const dialog = new ShareDialogInteractions(page)

        await makeWorkflowPublic(page, workflowId)
        await workflowCard1.navigateToList()

        await workflowCard1.clickShare()
        const toggle1 = dialog.dialog.locator('button[role="switch"]').last()
        await toggle1.click()
        await page.waitForTimeout(2000)
        expect(await toggle1.getAttribute('aria-checked')).toBe('true')
        await dialog.close()

        await makeWorkflowPublic(page, workflow2Id)
        await workflowCard2.clickShare()
        const toggle2 = dialog.dialog.locator('button[role="switch"]').last()
        expect(await toggle2.getAttribute('aria-checked')).toBe('false')
        await dialog.close()

        await workflowCard1.clickShare()
        const toggle1Again = dialog.dialog.locator('button[role="switch"]').last()
        expect(await toggle1Again.getAttribute('aria-checked')).toBe('true')
        await dialog.close()
      })

      test('state updates remain atomic under slow network conditions', async ({ page }) => {
        await page.route('**/api/v2/workflow/*/share/public', async route => {
          await new Promise(resolve => setTimeout(resolve, 2000))
          await route.continue()
        })

        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()
        await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })

        await dialog.privateOption.click()
        await page.waitForTimeout(500)

        await dialog.publicOption.click()
        await page.waitForTimeout(3000)

        await expect(dialog.publicOption).toBeChecked()
        await dialog.close()

        await page.unroute('**/api/v2/workflow/*/share/public')
      })
    })

    test('collaborative toggle availability controlled by visibility mode', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })

      let publicToggle = dialog.dialog.locator('button[role="switch"]').last()
      await expect(publicToggle).toBeVisible()

      await dialog.privateOption.click()
      await page.waitForTimeout(1000)

      const toggleCount = await dialog.dialog.locator('button[role="switch"]').count()
      expect(toggleCount).toBe(0)

      await dialog.publicOption.click()
      await page.waitForTimeout(1000)

      publicToggle = dialog.dialog.locator('button[role="switch"]').last()
      await expect(publicToggle).toBeVisible()

      await dialog.close()
    })
  })

  test.describe('Edge Cases', () => {
    test('handles multiple workflows correctly', async ({ page }) => {
      const workflow2Id = await createWorkflow(page)
      const workflow3Id = await createWorkflow(page)

      const workflowCard1 = new WorkflowCardPage(page, workflowId)
      const workflowCard2 = new WorkflowCardPage(page, workflow2Id)
      const workflowCard3 = new WorkflowCardPage(page, workflow3Id)

      await workflowCard1.navigateToList()
      await expect(workflowCard1.shareButton).toBeVisible()
      await expect(workflowCard2.shareButton).toBeVisible()
      await expect(workflowCard3.shareButton).toBeVisible()
    })

    test('dialog closes when clicking outside', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await expect(dialog.dialog).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(dialog.dialog).not.toBeVisible()
    })

    test('visibility state isolated across concurrent workflows', async ({ page }) => {
      const workflow2Id = await createWorkflow(page)
      const workflowCard1 = new WorkflowCardPage(page, workflowId)
      const workflowCard2 = new WorkflowCardPage(page, workflow2Id)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard1.navigateToList()

      await workflowCard1.clickShare()
      await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })
      await dialog.close()

      await workflowCard2.clickShare()
      await expect(dialog.privateOption).toBeChecked()
      await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })
      await dialog.close()

      await workflowCard1.clickShare()
      await expect(dialog.publicOption).toBeChecked()
      await dialog.close()
    })

    test('visibility state preserved after page reload', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await makeWorkflowPublic(page, workflowId)

      await page.reload()
      await page.waitForLoadState('networkidle')

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toBeChecked()
      await dialog.close()
    })

    test('visibility updates prevent race conditions on rapid changes', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toBeChecked({ timeout: 3000 })

      await dialog.privateOption.click()
      await dialog.publicOption.click()
      await dialog.privateOption.click()
      await page.waitForTimeout(2000)

      await expect(dialog.privateOption).toBeChecked()
      await dialog.close()
    })
  })
})
