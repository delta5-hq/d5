import type { Page, Locator } from '@playwright/test'

export class LandingPage {
  readonly page: Page
  readonly loginButton: Locator
  readonly signupButton: Locator

  constructor(page: Page) {
    this.page = page
    this.loginButton = page.locator('[data-type="login"]')
    this.signupButton = page.locator('[data-type="signup"]')
  }

  async openLoginDialog(): Promise<void> {
    await this.loginButton.click()
    await this.page.waitForTimeout(500)
  }

  async navigateToSignup(): Promise<void> {
    await this.signupButton.click()
  }

  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.page.waitForLoadState('networkidle')
  }
}
