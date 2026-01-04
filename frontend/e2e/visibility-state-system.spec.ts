import { test, expect } from '@playwright/test'
import { adminLogin, createWorkflow } from './utils'
import { WorkflowCardPage } from './page-objects/workflow-card.page'
import { ShareDialogInteractions } from './page-objects/share-dialog-interactions.page'

test.describe('Visibility State System', () => {
  let workflowId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await adminLogin(page)
    workflowId = await createWorkflow(page)
  })

  test.describe('Radio Button Rendering with Composite States', () => {
    test('radio button shows checked when collaborative toggle is ON for public', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await dialog.publicLabel.click()
      await dialog.waitForPersistence()
      
      await expect(dialog.publicOption).toHaveAttribute('data-state', 'checked', { timeout: 10000 })

      const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
      await publicToggle.click()
      await dialog.waitForPersistence()
      
      await expect(publicToggle).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })
      await expect(dialog.publicOption).toHaveAttribute('data-state', 'checked', { timeout: 5000 })

      await dialog.close()
    })

    test('radio button shows checked when collaborative toggle is ON for unlisted', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      const unlistedLabel = dialog.dialog.locator('label:has-text("Unlisted"), label[for="unlisted"]').first()
      await unlistedLabel.click()
      await dialog.waitForPersistence()

      const unlistedRadio = dialog.dialog.locator('button[role="radio"][value="unlisted"]').first()
      await expect(unlistedRadio).toHaveAttribute('data-state', 'checked', { timeout: 10000 })

      const unlistedToggle = dialog.dialog.locator('button[role="switch"]').first()
      await unlistedToggle.click()
      await dialog.waitForPersistence()

      await expect(unlistedToggle).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })
      await expect(unlistedRadio).toHaveAttribute('data-state', 'checked', { timeout: 5000 })

      await dialog.close()
    })

    test('radio button updates immediately when toggling collaborative state', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await dialog.publicLabel.click()
      await dialog.waitForPersistence()

      const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
      
      await publicToggle.click()
      await dialog.waitForPersistence()
      await expect(dialog.publicOption).toHaveAttribute('data-state', 'checked')

      await publicToggle.click()
      await dialog.waitForPersistence()
      await expect(dialog.publicOption).toHaveAttribute('data-state', 'checked')

      await dialog.close()
    })
  })

  test.describe('Visibility Mode Preservation Across Transitions', () => {
    const visibilityTransitions = [
      { from: 'private', to: 'public', label: 'publicLabel', option: 'publicOption' },
      { from: 'private', to: 'unlisted', label: 'unlistedLabel', option: 'unlistedOption' },
      { from: 'public', to: 'private', label: 'privateLabel', option: 'privateOption' },
      { from: 'public', to: 'unlisted', label: 'unlistedLabel', option: 'unlistedOption' },
      { from: 'unlisted', to: 'private', label: 'privateLabel', option: 'privateOption' },
      { from: 'unlisted', to: 'public', label: 'publicLabel', option: 'publicOption' },
    ]

    visibilityTransitions.forEach(({ from, to, label }) => {
      test(`visibility persists when transitioning from ${from} to ${to}`, async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()

        if (from !== 'private') {
          const fromLabel = from === 'public' ? dialog.publicLabel : dialog.dialog.locator('label[for="unlisted"]').first()
          await fromLabel.click()
          await dialog.waitForPersistence()
        }

        const toLabel = to === 'public' ? dialog.publicLabel : 
                       to === 'unlisted' ? dialog.dialog.locator('label[for="unlisted"]').first() :
                       dialog.privateLabel

        await toLabel.click()
        await dialog.waitForPersistence()

        const targetRadio = to === 'public' ? dialog.publicOption :
                          to === 'unlisted' ? dialog.dialog.locator('button[role="radio"][value="unlisted"]').first() :
                          dialog.privateOption

        await expect(targetRadio).toHaveAttribute('data-state', 'checked', { timeout: 10000 })
        await dialog.close()

        await workflowCard.openShareDialog()
        await expect(targetRadio).toHaveAttribute('data-state', 'checked')
        await dialog.close()
      })
    })
  })

  test.describe('Collaborative State Preservation Matrix', () => {
    const collaborativeScenarios = [
      {
        mode: 'public',
        label: 'publicLabel',
        toggleSelector: 'button[role="switch"]:last-of-type',
        radioSelector: 'button[role="radio"][value="public"]',
      },
      {
        mode: 'unlisted',
        label: 'label[for="unlisted"]',
        toggleSelector: 'button[role="switch"]:first-of-type',
        radioSelector: 'button[role="radio"][value="unlisted"]',
      },
    ]

    collaborativeScenarios.forEach(({ mode, label, toggleSelector, radioSelector }) => {
      test(`${mode} collaborative state preserved across all visibility transitions`, async ({ page }) => {
        const workflowCard = new WorkflowCardPage(page, workflowId)
        const dialog = new ShareDialogInteractions(page)

        await workflowCard.openShareDialog()

        const modeLabel = mode === 'public' ? dialog.publicLabel : dialog.dialog.locator(label).first()
        await modeLabel.click()
        await dialog.waitForPersistence()

        const toggle = dialog.dialog.locator(toggleSelector)
        await toggle.click()
        await dialog.waitForPersistence()
        await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })

        const otherMode = mode === 'public' ? 'unlisted' : 'public'
        const otherLabel = otherMode === 'public' ? dialog.publicLabel : dialog.dialog.locator('label[for="unlisted"]').first()
        await otherLabel.click()
        await dialog.waitForPersistence()

        await modeLabel.click()
        await dialog.waitForPersistence()

        await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })

        const radio = dialog.dialog.locator(radioSelector)
        await expect(radio).toHaveAttribute('data-state', 'checked', { timeout: 10000 })

        await dialog.close()
      })
    })
  })

  test.describe('Independent Memory Verification', () => {
    test('enabling collaborative in one mode does not affect other modes', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      
      const unlistedLabel = dialog.dialog.locator('label[for="unlisted"]').first()
      await unlistedLabel.click()
      await expect(dialog.unlistedOption).toBeChecked({ timeout: 15000 })
      await dialog.waitForPersistence(30000)

      const unlistedToggle = dialog.dialog.locator('button[role="switch"]').first()
      await unlistedToggle.click()
      await expect(unlistedToggle).toHaveAttribute('aria-checked', 'true', { timeout: 15000 })
      await dialog.waitForPersistence(30000)

      await dialog.publicLabel.click()
      await expect(dialog.publicOption).toBeChecked({ timeout: 15000 })
      await dialog.waitForPersistence(30000)

      const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
      await expect(publicToggle).toHaveAttribute('aria-checked', 'false', { timeout: 15000 })

      await dialog.privateLabel.click()
      await expect(dialog.privateOption).toBeChecked({ timeout: 15000 })
      await dialog.waitForPersistence(30000)

      await dialog.publicLabel.click()
      await expect(dialog.publicOption).toBeChecked({ timeout: 15000 })
      await dialog.waitForPersistence(30000)
      await expect(publicToggle).toHaveAttribute('aria-checked', 'false', { timeout: 15000 })

      await unlistedLabel.click()
      await expect(dialog.unlistedOption).toBeChecked({ timeout: 15000 })
      await dialog.waitForPersistence(30000)
      await expect(unlistedToggle).toHaveAttribute('aria-checked', 'true', { timeout: 15000 })

      await dialog.close()
    })

    test('collaborative memory persists across workflow instances', async ({ page }) => {
      const workflow2Id = await createWorkflow(page)
      const workflowCard1 = new WorkflowCardPage(page, workflowId)
      const workflowCard2 = new WorkflowCardPage(page, workflow2Id)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard1.navigateToList()
      await workflowCard1.clickShare()
      await dialog.publicLabel.click()
      await dialog.waitForPersistence()

      const toggle1 = dialog.dialog.locator('button[role="switch"]').last()
      await toggle1.click()
      await dialog.waitForPersistence()
      await expect(toggle1).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })
      await dialog.close()

      await workflowCard2.clickShare()
      await dialog.publicLabel.click()
      await dialog.waitForPersistence()
      
      const toggle2 = dialog.dialog.locator('button[role="switch"]').last()
      await expect(toggle2).toHaveAttribute('aria-checked', 'false')
      await dialog.close()
    })
  })

  test.describe('Edge Cases and Boundary Conditions', () => {
    test('collaborative toggle rapid clicks maintain final state', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await dialog.publicLabel.click()
      await dialog.waitForPersistence()

      const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
      
      await publicToggle.click()
      await publicToggle.click()
      await publicToggle.click()
      await publicToggle.click()
      await publicToggle.click()
      
      await dialog.waitForPersistence()
      
      const finalState = await publicToggle.getAttribute('aria-checked')
      await dialog.close()

      await workflowCard.openShareDialog()
      await expect(publicToggle).toHaveAttribute('aria-checked', finalState!)
      await dialog.close()
    })

    test('visibility state persists through page reload', async ({ page }) => {
      const workflowCard = new WorkflowCardPage(page, workflowId)
      const dialog = new ShareDialogInteractions(page)

      await workflowCard.openShareDialog()
      await dialog.publicLabel.click()
      await dialog.waitForPersistence()

      const publicToggle = dialog.dialog.locator('button[role="switch"]').last()
      await publicToggle.click()
      await dialog.waitForPersistence()
      await dialog.close()

      await page.reload()
      await page.waitForLoadState('networkidle')

      await workflowCard.openShareDialog()
      await expect(dialog.publicOption).toHaveAttribute('data-state', 'checked')
      await expect(publicToggle).toHaveAttribute('aria-checked', 'true')
      await dialog.close()
    })
  })
})
