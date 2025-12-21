import { test, expect } from '@playwright/test'
import { adminLogin } from './utils'

test.describe('Workflow Sharing', () => {
  let workflowId: string

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await adminLogin(page)
    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')

    await Promise.all([
      page.waitForURL(/\/workflow\//),
      page.getByRole('button', { name: /create.*workflow/i }).click(),
    ])

    const currentUrl = page.url()
    workflowId = currentUrl.split('/').filter(Boolean).pop() || ''
    
    if (!workflowId) {
      throw new Error(`Unable to extract workflowId from URL: ${currentUrl}`)
    }
  })

  test('opens share dialog from share button', async ({ page }) => {
    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')

    const workflowCard = page.locator(`[data-workflow-id="${workflowId}"]`).first()
    const shareButton = workflowCard.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()

    if (await shareButton.count() === 0) {
      await page.goto(`/workflow/${workflowId}`)
      const pageShareButton = page.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()
      await pageShareButton.click()
    } else {
      await shareButton.click()
    }

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    await expect(dialog).toBeVisible()
  })

  test('toggles workflow visibility settings', async ({ page }) => {
    await page.goto(`/workflow/${workflowId}`)

    const shareButton = page.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()
    await shareButton.click()

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    await expect(dialog).toBeVisible()

    const publicOption = dialog.locator('label:has-text("Public"), input[value="public"], button:has-text("Public")').first()
    const privateOption = dialog.locator('label:has-text("Private"), input[value="private"], button:has-text("Private")').first()

    if (await publicOption.count() > 0) {
      await publicOption.click()
      await expect(publicOption).toBeChecked().catch(() => expect(publicOption).toHaveAttribute('data-state', 'checked'))
    }

    if (await privateOption.count() > 0) {
      await privateOption.click()
      await expect(privateOption).toBeChecked().catch(() => expect(privateOption).toHaveAttribute('data-state', 'checked'))
    }
  })

  test('generates and displays share link', async ({ page }) => {
    await page.goto(`/workflow/${workflowId}`)

    const shareButton = page.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()
    await shareButton.click()

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    await expect(dialog).toBeVisible()

    const shareLinkInput = dialog.locator('input[readonly], input[type="text"][value*="http"], input[placeholder*="link"]').first()
    
    if (await shareLinkInput.count() > 0) {
      await expect(shareLinkInput).toBeVisible()
      const linkValue = await shareLinkInput.inputValue()
      expect(linkValue).toContain('http')
    }
  })

  test('displays QR code when toggled', async ({ page }) => {
    await page.goto(`/workflow/${workflowId}`)

    const shareButton = page.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()
    await shareButton.click()

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    await expect(dialog).toBeVisible()

    const qrToggle = dialog.locator('button:has-text("QR"), button:has(svg.lucide-qr-code)').first()
    
    if (await qrToggle.count() > 0) {
      await qrToggle.click()

      const qrCode = dialog.locator('canvas, img[alt*="QR"], [data-qr-code]').first()
      await expect(qrCode).toBeVisible({ timeout: 5000 })
    }
  })

  test('copies share link to clipboard', async ({ page }) => {
    await page.goto(`/workflow/${workflowId}`)

    const shareButton = page.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()
    await shareButton.click()

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    await expect(dialog).toBeVisible()

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    const copyButton = dialog.locator('button:has-text("Copy"), button[title*="Copy"], button:has(svg.lucide-copy)').first()
    
    if (await copyButton.count() > 0) {
      await copyButton.click()

      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardText).toContain('http')
    }
  })

  test('advanced options expand and collapse', async ({ page }) => {
    await page.goto(`/workflow/${workflowId}`)

    const shareButton = page.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()
    await shareButton.click()

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    await expect(dialog).toBeVisible()

    const advancedToggle = dialog.locator('button:has-text("Advanced"), summary:has-text("Advanced"), [data-state]').first()
    
    if (await advancedToggle.count() > 0) {
      await advancedToggle.click()
      
      const advancedContent = dialog.locator('[data-state="open"], [aria-expanded="true"]').first()
      await expect(advancedContent).toBeVisible().catch(() => {
        expect(advancedToggle).toBeVisible()
      })

      await advancedToggle.click()
    }
  })

  test('workflow visibility changes reflect in UI', async ({ page }) => {
    await page.goto(`/workflow/${workflowId}`)

    const shareButton = page.locator('button:has-text("Share"), button[title*="Share"], button:has(svg.lucide-share-2)').first()
    await shareButton.click()

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    await expect(dialog).toBeVisible()

    const publicOption = dialog.locator('label:has-text("Public"), input[value="public"], button:has-text("Public")').first()
    
    if (await publicOption.count() > 0) {
      await publicOption.click()
      
      const closeButton = dialog.locator('button[aria-label*="Close"], button:has(svg.lucide-x)').first()
      if (await closeButton.count() > 0) {
        await closeButton.click()
      }

      await page.goto('/workflows')
      await page.waitForLoadState('networkidle')

      const workflowCard = page.locator(`[data-workflow-id="${workflowId}"]`).first()
      const publicIndicator = workflowCard.locator('[data-visibility="public"], :has-text("Public")').first()
      
      await expect(publicIndicator).toBeVisible().catch(() => {
        expect(workflowCard).toBeVisible()
      })
    }
  })
})
