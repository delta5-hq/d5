import type { Locator, Page } from '@playwright/test'
import { TEST_TIMEOUTS } from '../constants/test-timeouts'
import { PageComponent } from '../helpers/base-page'

export class CreateWorkflowActionsPage extends PageComponent {
  get rootSelector(): string {
    return '[data-testid="create-workflow-popover"]'
  }

  get createNavItem(): Locator {
    return this.page.locator('[data-testid="primary-nav-create"]')
  }

  get popoverContainer(): Locator {
    return this.root
  }

  get createWorkflowButton(): Locator {
    return this.page.locator('[data-testid="create-workflow-button"]')
  }

  get createFromTemplateButton(): Locator {
    return this.page.locator('[data-testid="create-from-template-button"]')
  }

  async openCreatePopover(): Promise<void> {
    await this.createNavItem.click()
    await this.popoverContainer.waitFor({ state: 'visible', timeout: 5000 })
  }

  async clickCreateWorkflow(): Promise<void> {
    await this.openCreatePopover()
    await this.createWorkflowButton.click()
  }

  async clickCreateFromTemplate(): Promise<void> {
    await this.openCreatePopover()
    await this.createFromTemplateButton.click()
  }

  async createNewWorkflow(): Promise<string> {
    await this.clickCreateWorkflow()
    await this.page.waitForURL(/\/workflow\//, { timeout: TEST_TIMEOUTS.NAVIGATION })
    return this.extractWorkflowIdFromUrl(this.page.url())
  }

  async navigateToTemplates(): Promise<void> {
    await this.clickCreateFromTemplate()
    await this.page.waitForURL('/templates', { timeout: TEST_TIMEOUTS.NAVIGATION })
  }

  private extractWorkflowIdFromUrl(url: string): string {
    const workflowId = url.split('/').filter(Boolean).pop() || ''
    if (!workflowId) {
      throw new Error(`Unable to extract workflowId from URL: ${url}`)
    }
    return workflowId
  }

  async isPopoverVisible(): Promise<boolean> {
    return this.isComponentVisible()
  }

  async isCreateWorkflowButtonVisible(): Promise<boolean> {
    await this.openCreatePopover()
    return this.createWorkflowButton.isVisible()
  }

  async waitForPopoverClose(): Promise<void> {
    await this.popoverContainer.waitFor({ state: 'hidden', timeout: 5000 })
  }

  async isPopoverClosed(): Promise<boolean> {
    return !(await this.popoverContainer.isVisible())
  }

  async clickCreateNavItem(): Promise<void> {
    await this.createNavItem.click()
  }
}
