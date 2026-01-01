import type { Locator, Page } from '@playwright/test'

export class UserMenuPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  get menuTrigger(): Locator {
    return this.page.locator('[data-testid="user-menu-trigger"]')
  }

  get popoverContainer(): Locator {
    return this.page.locator('[data-testid="user-popover"]')
  }

  get logoutButton(): Locator {
    return this.page.locator('[data-testid="logout-button"]')
  }

  get settingsButton(): Locator {
    return this.page.locator('[data-testid="settings-button"]')
  }

  get profileButton(): Locator {
    return this.page.locator('[data-testid="profile-button"]')
  }

  async openUserMenu(): Promise<void> {
    await this.menuTrigger.click()
    await this.popoverContainer.waitFor({ state: 'visible', timeout: 5000 })
  }

  async logout(): Promise<void> {
    await this.openUserMenu()
    await this.logoutButton.click()
  }

  async navigateToSettings(): Promise<void> {
    await this.openUserMenu()
    await this.settingsButton.click()
  }

  async navigateToProfile(): Promise<void> {
    await this.openUserMenu()
    await this.profileButton.click()
  }

  async isMenuOpen(): Promise<boolean> {
    return this.popoverContainer.isVisible()
  }

  async waitForMenuClose(): Promise<void> {
    await this.popoverContainer.waitFor({ state: 'hidden', timeout: 5000 })
  }

  async isMenuClosed(): Promise<boolean> {
    return !(await this.popoverContainer.isVisible())
  }

  async clickMenuTrigger(): Promise<void> {
    await this.menuTrigger.click()
  }
}
