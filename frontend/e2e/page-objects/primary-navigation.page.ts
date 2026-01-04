import type { Locator, Page } from '@playwright/test'
import { TEST_TIMEOUTS } from '../constants/test-timeouts'
import { PageComponent } from '../helpers/base-page'

type NavigationSection = 'home' | 'create' | 'settings' | 'admin' | 'training' | 'landing'

export class PrimaryNavigationPage extends PageComponent {
  get rootSelector(): string {
    return '[data-testid="primary-sidebar"]'
  }

  item(section: NavigationSection): Locator {
    return this.page.locator(`[data-testid="primary-nav-${section}"]`)
  }

  get homeItem(): Locator {
    return this.item('home')
  }

  get createItem(): Locator {
    return this.item('create')
  }

  get settingsItem(): Locator {
    return this.item('settings')
  }

  get adminItem(): Locator {
    return this.item('admin')
  }

  get trainingItem(): Locator {
    return this.item('training')
  }

  async clickHome(): Promise<void> {
    await this.homeItem.click()
  }

  async clickCreate(): Promise<void> {
    await this.createItem.click()
  }

  async clickSettings(): Promise<void> {
    await this.settingsItem.click()
  }

  async clickAdmin(): Promise<void> {
    await this.adminItem.click()
  }

  async clickTraining(): Promise<void> {
    await this.trainingItem.click()
  }

  async clickSection(section: NavigationSection | string): Promise<void> {
    await this.page.locator(`[data-testid="primary-nav-${section}"]`).click()
  }

  async getSectionWidth(): Promise<number | null> {
    const box = await this.root.boundingBox()
    return box?.width ?? null
  }

  async waitForTransition(): Promise<void> {
    await this.page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
  }
}
