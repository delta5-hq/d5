import type { Locator, Page } from '@playwright/test'
import { TEST_TIMEOUTS } from '../constants/test-timeouts'

export class SecondarySidebarPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  get root(): Locator {
    return this.page.locator('[data-testid="secondary-sidebar"]')
  }

  get myWorkflowsLink(): Locator {
    return this.root.getByRole('link', { name: 'My Workflows' })
  }

  get myTemplatesLink(): Locator {
    return this.root.getByRole('link', { name: 'My templates' })
  }

  get settingsLink(): Locator {
    return this.root.getByRole('link', { name: 'Settings' })
  }

  get waitlistLink(): Locator {
    return this.root.getByRole('link', { name: 'Waitlist' })
  }

  get trainingLink(): Locator {
    return this.root.getByRole('link', { name: 'Training' })
  }

  get createWorkflowButton(): Locator {
    return this.root.getByRole('button', { name: 'Create workflow' })
  }

  groupLabel(name: string): Locator {
    return this.root.locator('[data-sidebar="group-label"]', { hasText: name })
  }

  firstGroupWithText(text: string): Locator {
    return this.root.getByText(text).first()
  }

  async isVisible(): Promise<boolean> {
    return this.root.isVisible()
  }

  async hasMyWorkflowsLink(): Promise<boolean> {
    return this.myWorkflowsLink.isVisible()
  }

  async hasMyTemplatesLink(): Promise<boolean> {
    return this.myTemplatesLink.isVisible()
  }

  async hasSettingsLink(): Promise<boolean> {
    return this.settingsLink.isVisible()
  }

  async hasWaitlistLink(): Promise<boolean> {
    return this.waitlistLink.isVisible()
  }

  async hasTrainingLink(): Promise<boolean> {
    return this.trainingLink.isVisible()
  }

  async hasGroupLabel(name: string): Promise<boolean> {
    return this.groupLabel(name).isVisible()
  }

  async hasTagsGroup(): Promise<boolean> {
    return this.firstGroupWithText('Tags').isVisible()
  }

  async hasRecentItemsGroup(): Promise<boolean> {
    return this.firstGroupWithText('Recent Items').isVisible()
  }

  async clickMyWorkflows(): Promise<void> {
    await this.myWorkflowsLink.click()
  }

  async clickMyTemplates(): Promise<void> {
    await this.myTemplatesLink.click()
  }

  async clickSettings(): Promise<void> {
    await this.settingsLink.click()
  }

  async clickCreateWorkflow(): Promise<void> {
    await this.createWorkflowButton.click()
  }

  async getTextContent(): Promise<string | null> {
    return this.root.textContent()
  }

  async count(): Promise<number> {
    return this.root.count()
  }

  async waitForVisible(): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.SIDEBAR_TRANSITION * 2 })
  }

  async waitForTransition(): Promise<void> {
    await this.page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
  }
}
