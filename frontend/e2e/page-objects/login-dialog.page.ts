import type { Page, Locator } from '@playwright/test'

export class LoginDialogPage {
  readonly page: Page
  readonly usernameInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly cancelButton: Locator
  readonly forgotPasswordLink: Locator
  readonly signupLink: Locator

  constructor(page: Page) {
    this.page = page
    this.usernameInput = page.getByTestId('login-username-input')
    this.passwordInput = page.getByTestId('login-password-input')
    this.submitButton = page.getByTestId('login-submit-button')
    this.cancelButton = page.locator('[data-type="cancel"]')
    this.forgotPasswordLink = page.getByRole('link', { name: /forgot.*password/i })
    this.signupLink = page.getByRole('link', { name: /sign up/i })
  }

  async fillCredentials(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username)
    await this.passwordInput.fill(password)
  }

  async submitLogin(): Promise<void> {
    await this.submitButton.click()
  }

  async loginAs(username: string, password: string): Promise<void> {
    await this.fillCredentials(username, password)
    await this.submitLogin()
  }

  async isDialogVisible(): Promise<boolean> {
    return await this.usernameInput.isVisible({ timeout: 1000 }).catch(() => false)
  }

  async waitForDialog(): Promise<void> {
    await this.usernameInput.waitFor({ state: 'visible', timeout: 5000 })
  }
}
