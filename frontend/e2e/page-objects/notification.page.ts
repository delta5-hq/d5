import type { Page, Locator } from '@playwright/test'

export class NotificationPage {
  readonly page: Page
  readonly toastContainer: Locator
  readonly alertContainer: Locator

  constructor(page: Page) {
    this.page = page
    this.toastContainer = page.locator('[data-sonner-toast]')
    this.alertContainer = page.locator('[role="alert"]')
  }

  async hasErrorWithText(pattern: RegExp): Promise<boolean> {
    const hasToast = await this.toastContainer.count() > 0
    const hasAlert = await this.alertContainer.count() > 0
    const hasTextMatch = await this.page.getByText(pattern).count() > 0
    
    return hasToast || hasAlert || hasTextMatch
  }

  async waitForError(timeout = 3000): Promise<void> {
    await this.page.waitForSelector('[data-sonner-toast], [role="alert"]', { 
      timeout,
      state: 'visible' 
    })
  }

  async getErrorText(): Promise<string> {
    const toast = this.toastContainer.first()
    if (await toast.isVisible()) {
      return await toast.textContent() || ''
    }
    
    const alert = this.alertContainer.first()
    if (await alert.isVisible()) {
      return await alert.textContent() || ''
    }
    
    return ''
  }
}
