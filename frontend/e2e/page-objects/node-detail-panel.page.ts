import type { Locator } from '@playwright/test'
import { PageComponent } from '../helpers/base-page'

export class NodeDetailPanelPage extends PageComponent {
  get rootSelector(): string {
    return '[data-testid="node-detail-panel"]'
  }

  get settingsTrigger(): Locator {
    return this.page.getByTestId('settings-trigger')
  }

  get executeButton(): Locator {
    return this.page.getByTestId('execute-node-button')
  }

  get addChildButton(): Locator {
    return this.page.getByTestId('add-child-node-button')
  }

  get duplicateButton(): Locator {
    return this.page.getByTestId('duplicate-node-button')
  }

  get deleteButton(): Locator {
    return this.page.getByTestId('delete-node-button')
  }

  get genie(): Locator {
    return this.page.getByTestId('node-genie')
  }

  get commandInput(): Locator {
    return this.root.locator('textarea')
  }

  get previewSection(): Locator {
    return this.page.getByTestId('node-preview-section')
  }

  get previewText(): Locator {
    return this.page.getByTestId('node-preview-text')
  }

  get previewError(): Locator {
    return this.page.getByTestId('node-preview-error')
  }

  async settingsState(): Promise<'open' | 'closed'> {
    const state = await this.settingsTrigger.getAttribute('data-state')
    return state as 'open' | 'closed'
  }

  async toggleSettings(): Promise<void> {
    await this.settingsTrigger.click()
  }

  async fillCommand(value: string): Promise<void> {
    await this.commandInput.fill(value)
    await this.commandInput.blur()
  }

  async execute(): Promise<void> {
    await this.executeButton.click()
  }

  async addChild(): Promise<void> {
    await this.addChildButton.click()
  }
}
