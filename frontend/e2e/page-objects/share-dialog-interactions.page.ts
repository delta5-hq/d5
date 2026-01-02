import type { Page, Locator } from '@playwright/test'
import { TIMEOUTS } from '../config/test-timeouts'
import { SELECTORS, type VisibilityMode, type CollaborativeMode } from '../config/test-selectors'

export class ShareDialogInteractions {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  get dialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /share/i })
  }

  get publicOption(): Locator {
    return this.dialog.locator('button[role="radio"][value="public"]').first()
  }

  get publicLabel(): Locator {
    return this.dialog.locator('label[for="public"]').first()
  }

  get privateOption(): Locator {
    return this.dialog.locator('button[role="radio"][value="private"]').first()
  }

  get privateLabel(): Locator {
    return this.dialog.locator('label[for="private"]').first()
  }

  get unlistedOption(): Locator {
    return this.dialog.locator('button[role="radio"][value="unlisted"]').first()
  }

  get unlistedLabel(): Locator {
    return this.dialog.locator('label[for="unlisted"]').first()
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

    try {
      await this.page.waitForFunction(() => navigator.clipboard.readText())
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

  async waitForPersistence(timeoutMs: number = TIMEOUTS.BACKEND_SYNC): Promise<void> {
    await this.dialog.waitFor({ state: 'visible', timeout: TIMEOUTS.UI_UPDATE })
    
    await this.page.waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]')
        const persisting = dialog?.getAttribute('data-persisting')
        const refetching = dialog?.getAttribute('data-refetching')
        return persisting === 'false' && refetching === 'false'
      },
      { timeout: timeoutMs }
    )
  }

  getCollaborativeToggleForMode(mode: CollaborativeMode): Locator {
    return this.dialog.locator(SELECTORS.collaborativeToggle(mode))
  }

  getVisibilityRadioForMode(mode: VisibilityMode): Locator {
    return this.dialog.locator(SELECTORS.visibilityRadio(mode)).first()
  }

  getVisibilityLabelForMode(mode: VisibilityMode): Locator {
    return this.dialog.locator(SELECTORS.visibilityLabel(mode)).first()
  }

  async setVisibilityMode(mode: VisibilityMode): Promise<void> {
    const option = this.getVisibilityRadioForMode(mode)
    await option.click()
    await option.page().waitForTimeout(TIMEOUTS.UI_UPDATE)
    await this.waitForPersistence()
  }

  async enableCollaborativeForMode(mode: CollaborativeMode, enable: boolean = true): Promise<void> {
    const toggle = this.getCollaborativeToggleForMode(mode)
    const currentState = await toggle.getAttribute('aria-checked')
    const shouldClick = (enable && currentState === 'false') || (!enable && currentState === 'true')
    
    if (shouldClick) {
      await toggle.click()
      await toggle.page().waitForTimeout(TIMEOUTS.UI_UPDATE)
      await this.waitForPersistence()
    }
  }

  async getCollaborativeStateForMode(mode: CollaborativeMode): Promise<boolean> {
    const toggle = this.getCollaborativeToggleForMode(mode)
    const ariaChecked = await toggle.getAttribute('aria-checked')
    return ariaChecked === 'true'
  }

  async getCurrentVisibilityMode(): Promise<VisibilityMode | null> {
    const modes: VisibilityMode[] = ['private', 'public', 'unlisted']
    
    for (const mode of modes) {
      const radio = this.getVisibilityRadioForMode(mode)
      const dataState = await radio.getAttribute('data-state')
      const ariaChecked = await radio.getAttribute('aria-checked')
      
      if (dataState === 'checked' || ariaChecked === 'true') {
        return mode
      }
    }
    
    return null
  }
}
