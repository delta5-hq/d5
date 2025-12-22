import type { Page, Locator } from '@playwright/test'

/* @deprecated Use WorkflowCardPage + ShareDialogInteractions (violates SRP) */
export class ShareDialogPage {
  readonly page: Page
  readonly dialog: Locator
  readonly shareButton: Locator
  readonly publicOption: Locator
  readonly privateOption: Locator
  readonly shareLinkInput: Locator
  readonly copyButton: Locator
  readonly qrToggle: Locator
  readonly qrCode: Locator
  readonly advancedToggle: Locator
  readonly advancedContent: Locator
  readonly closeButton: Locator

  constructor(page: Page) {
    this.page = page
    this.dialog = page.locator('[role="dialog"]').filter({ hasText: /share/i })
    this.shareButton = page.getByTestId('workflow-share-button')
    this.publicOption = this.dialog.locator(
      'label:has-text("Public"), input[value="public"], button:has-text("Public")'
    ).first()
    this.privateOption = this.dialog.locator(
      'label:has-text("Private"), input[value="private"], button:has-text("Private")'
    ).first()
    this.shareLinkInput = this.dialog.locator(
      'input[readonly], input[type="text"][value*="http"], input[placeholder*="link"]'
    ).first()
    this.copyButton = this.dialog.locator(
      'button:has-text("Copy"), button[title*="Copy"], button:has(svg.lucide-copy)'
    ).first()
    this.qrToggle = this.dialog.locator('button:has-text("QR"), button:has(svg.lucide-qr-code)').first()
    this.qrCode = this.dialog.locator('canvas, img[alt*="QR"], [data-qr-code]').first()
    this.advancedToggle = this.dialog.locator(
      'button:has-text("Advanced"), summary:has-text("Advanced"), [data-state]'
    ).first()
    this.advancedContent = this.dialog.locator('[data-state="open"], [aria-expanded="true"]').first()
    this.closeButton = this.dialog.locator('button[aria-label*="Close"], button:has(svg.lucide-x)').first()
  }

  async openFromWorkflowCard(workflowId: string): Promise<void> {
    await this.page.goto('/workflows')
    await this.page.waitForLoadState('networkidle')

    const workflowCard = this.page.locator(`[data-workflow-id="${workflowId}"]`).first()
    const cardShareButton = workflowCard.getByTestId('workflow-share-button')

    const buttonExists = (await cardShareButton.count()) > 0

    if (!buttonExists) {
      await this.openFromWorkflowPage(workflowId)
    } else {
      await cardShareButton.click()
    }
  }

  async openFromWorkflowPage(workflowId: string): Promise<void> {
    await this.page.goto(`/workflow/${workflowId}`)
    await this.page.waitForLoadState('networkidle')
    await this.shareButton.click()
  }

  async isDialogVisible(): Promise<boolean> {
    return await this.dialog.isVisible()
  }

  async togglePublicPrivate(): Promise<void> {
    if ((await this.publicOption.count()) > 0) {
      await this.publicOption.click()
    }

    if ((await this.privateOption.count()) > 0) {
      await this.privateOption.click()
    }
  }

  async getShareLink(): Promise<string | null> {
    if ((await this.shareLinkInput.count()) === 0) {
      return null
    }
    return await this.shareLinkInput.inputValue()
  }

  async copyShareLinkToClipboard(): Promise<string | null> {
    await this.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])

    if ((await this.copyButton.count()) === 0) {
      return null
    }

    await this.copyButton.click()
    return await this.page.evaluate(() => navigator.clipboard.readText())
  }

  async toggleQRCode(): Promise<boolean> {
    if ((await this.qrToggle.count()) === 0) {
      return false
    }

    await this.qrToggle.click()
    return true
  }

  async isQRCodeVisible(): Promise<boolean> {
    return await this.qrCode.isVisible({ timeout: 5000 }).catch(() => false)
  }

  async toggleAdvancedOptions(): Promise<boolean> {
    if ((await this.advancedToggle.count()) === 0) {
      return false
    }

    await this.advancedToggle.click()
    return true
  }

  async isAdvancedContentVisible(): Promise<boolean> {
    return await this.advancedContent.isVisible().catch(() => false)
  }

  async closeDialog(): Promise<void> {
    if ((await this.closeButton.count()) > 0) {
      await this.closeButton.click()
    }
  }
}
