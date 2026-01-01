import type { Locator, Page } from '@playwright/test'
import { TEST_TIMEOUTS } from '../constants/test-timeouts'
import { PageComponent } from '../helpers/base-page'

export class SecondarySidebarPage extends PageComponent {
  get rootSelector(): string {
    return '[data-testid="secondary-sidebar"]'
  }

  get mobileRootSelector(): string {
    return '[data-testid="mobile-secondary-sidebar"]'
  }

  get mobileRoot(): Locator {
    return this.page.locator(this.mobileRootSelector)
  }

  get mobileOverlayContainer(): Locator {
    return this.page.locator('[data-radix-presence]').first()
  }

  get mobileDismissButton(): Locator {
    return this.mobileRoot.getByRole('button', { name: 'Close menu' })
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

  get mobileCloseButton(): Locator {
    return this.root.getByRole('button', { name: 'Close menu' })
  }

  groupLabel(name: string): Locator {
    return this.root.locator('[data-sidebar="group-label"]', { hasText: name })
  }

  firstGroupWithText(text: string): Locator {
    return this.root.getByText(text).first()
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

  async clickMobileClose(): Promise<void> {
    await this.mobileCloseButton.click()
  }

  async hasMobileCloseButton(): Promise<boolean> {
    return this.mobileCloseButton.isVisible()
  }

  async getBoundingBox(): Promise<{ width: number; height: number; x: number; y: number } | null> {
    return this.root.boundingBox()
  }

  async getTextContent(): Promise<string | null> {
    return this.root.textContent()
  }

  async waitForVisible(): Promise<void> {
    await this.root.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.SIDEBAR_TRANSITION * 2 })
  }

  async waitForTransition(): Promise<void> {
    await this.page.waitForTimeout(TEST_TIMEOUTS.SIDEBAR_TRANSITION)
  }

  async isMobileOverlayVisible(): Promise<boolean> {
    const overlay = this.page.locator('[data-radix-presence][data-state="open"]')
    return overlay.isVisible().catch(() => false)
  }

  async isMobileSidebarVisible(): Promise<boolean> {
    return this.mobileRoot.isVisible().catch(() => false)
  }

  async clickMobileDismissButton(): Promise<void> {
    await this.mobileDismissButton.click()
  }

  async hasWaitlistLinkInContext(): Promise<boolean> {
    return this.waitlistLink.isVisible().catch(() => false)
  }
}
