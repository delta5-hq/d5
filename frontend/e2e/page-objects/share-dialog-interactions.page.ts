import type { Page, Locator } from '@playwright/test'

export class ShareDialogInteractions {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  get dialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /share/i })
  }

  get publicOption(): Locator {
    return this.dialog.locator(
      'label:has-text("Public"), input[value="public"], button:has-text("Public")'
    ).first()
  }

  get privateOption(): Locator {
    return this.dialog.locator(
      'label:has-text("Private"), input[value="private"], button:has-text("Private")'
    ).first()
  }

  get shareLinkInput(): Locator {
    return this.dialog.locator(
      'input[readonly], input[type="text"][value*="http"], input[placeholder*="link"]'
    ).first()
  }

  get copyButton(): Locator {
    return this.dialog.locator(
      'button:has-text("Copy"), button[title*="Copy"], button:has(svg.lucide-copy)'
    ).first()
  }

  get qrToggle(): Locator {
    return this.dialog.locator('button:has(svg.lucide-qr-code)').first()
  }

  get qrCode(): Locator {
    return this.dialog.locator('canvas').first()
  }

  get advancedToggle(): Locator {
    return this.dialog.locator(
      'button:has-text("Advanced"), summary:has-text("Advanced"), [data-state]'
    ).first()
  }

  get advancedContent(): Locator {
    return this.dialog.locator('[data-state="open"], [aria-expanded="true"]').first()
  }

  get closeButton(): Locator {
    return this.dialog.locator('button[aria-label*="Close"], button:has(svg.lucide-x)').first()
  }

  async isVisible(): Promise<boolean> {
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

  async toggleQRCode(): Promise<boolean> {
    if ((await this.qrToggle.count()) === 0) {
      return false
    }

    await this.qrToggle.click()
    return true
  }

  async isQRCodeVisible(): Promise<boolean> {
    return await this.qrCode.isVisible()
  }

  async copyShareLinkToClipboard(): Promise<string | null> {
    if ((await this.copyButton.count()) === 0) {
      return null
    }

    await this.copyButton.click()
    await this.page.waitForTimeout(500)

    try {
      return await this.page.evaluate(() => navigator.clipboard.readText())
    } catch {
      return null
    }
  }

  async toggleAdvancedOptions(): Promise<boolean> {
    if ((await this.advancedToggle.count()) === 0) {
      return false
    }

    await this.advancedToggle.click()
    return true
  }

  async isAdvancedContentVisible(): Promise<boolean> {
    return await this.advancedContent.isVisible()
  }

  async close(): Promise<void> {
    await this.closeButton.click()
  }
}
