import type { Page, Locator } from '@playwright/test'

export class WorkflowCardPage {
  readonly page: Page
  readonly workflowId: string

  constructor(page: Page, workflowId: string) {
    this.page = page
    this.workflowId = workflowId
  }

  get card(): Locator {
    return this.page.locator(`[data-workflow-id="${this.workflowId}"]`).first()
  }

  get shareButton(): Locator {
    return this.card.getByTestId('workflow-share-button')
  }

  async navigateToList(): Promise<void> {
    await this.page.goto('/workflows')
    await this.page.waitForLoadState('networkidle')
  }

  async clickShare(): Promise<void> {
    await this.shareButton.click()
  }

  async openShareDialog(): Promise<void> {
    await this.navigateToList()
    await this.clickShare()
  }
}
