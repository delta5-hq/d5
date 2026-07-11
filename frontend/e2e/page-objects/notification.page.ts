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

  async hasErrorWithText(pattern: RegExp, timeout = 3000): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        ({ toastSel, alertSel, patternStr, patternFlags }) => {
          const re = new RegExp(patternStr, patternFlags)
          const toasts = document.querySelectorAll(toastSel)
          const alerts = document.querySelectorAll(alertSel)
          const all = [...toasts, ...alerts]
          return all.some(el => re.test(el.textContent || ''))
        },
        { toastSel: '[data-sonner-toast]', alertSel: '[role="alert"]', patternStr: pattern.source, patternFlags: pattern.flags },
        { timeout },
      )
      return true
    } catch {
      return false
    }
  }

  async waitForError(timeout = 3000): Promise<void> {
    await this.page.waitForSelector('[data-sonner-toast], [role="alert"]', {
      timeout,
      state: 'visible',
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
