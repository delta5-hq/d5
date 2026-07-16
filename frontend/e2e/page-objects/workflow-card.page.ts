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
    // `networkidle` never settles under throttled-network tests (ongoing polling),
    // timing out on firefox. Wait for the specific card instead — deterministic.
    await this.card.waitFor({ state: 'visible', timeout: 30_000 })
  }

  async clickShare(): Promise<void> {
    await this.card.scrollIntoViewIfNeeded()
    await this.shareButton.waitFor({ state: 'visible', timeout: 30_000 })
    await this.shareButton.evaluate(el => (el as HTMLElement).click())
  }

  async openShareDialog(): Promise<void> {
    await this.navigateToList()
    await this.clickShare()
  }
}
