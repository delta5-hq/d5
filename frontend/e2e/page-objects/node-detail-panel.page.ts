import type { Locator } from '@playwright/test'
import { PageComponent } from '../helpers/base-page'

export class NodeDetailPanelPage extends PageComponent {
  get rootSelector(): string {
    return '[data-testid="node-detail-panel"]'
  }

  get executeButton(): Locator {
    return this.page.getByTestId('execute-node-button')
  }

  get abortButton(): Locator {
    return this.page.getByTestId('abort-node-button')
  }

  get outputSection(): Locator {
    return this.page.getByTestId('output-section')
  }

  get outputGenie(): Locator {
    return this.page.getByTestId('output-genie')
  }

  get outputStatusLine(): Locator {
    return this.page.getByTestId('output-status-line')
  }

  get commandSection(): Locator {
    return this.page.getByTestId('command-section')
  }

  get commandRoleChip(): Locator {
    return this.page.getByTestId('command-role-chip')
  }

  get validationMessage(): Locator {
    return this.page.getByTestId('command-validation-message')
  }

  get renameButton(): Locator {
    return this.page.getByTestId('rename-node-button')
  }

  get commandInput(): Locator {
    return this.root.locator('textarea')
  }

  get outputText(): Locator {
    return this.page.getByTestId('node-preview-text')
  }

  get backButton(): Locator {
    return this.page.getByTestId('close-detail-panel-button')
  }

  async fillCommand(value: string): Promise<void> {
    await this.commandInput.fill(value)
    await this.commandInput.blur()
  }

  async execute(): Promise<void> {
    await this.executeButton.waitFor({ state: 'visible' })
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="execute-node-button"]')
        return btn && !(btn as HTMLButtonElement).disabled
      },
      { timeout: 5000 },
    )
    await this.executeButton.click()
  }

  async addChild(): Promise<void> {
    const selectedRoot = this.page.getByTestId('workflow-root-header').locator('[data-node-selected="true"]')
    if (await selectedRoot.isVisible()) {
      const rootHeader = this.page.getByTestId('workflow-root-header')
      await rootHeader.hover()
      await rootHeader.getByTestId('root-add-child').click()
      return
    }

    const selectedRow = this.page.locator('[data-node-id][data-node-selected="true"]').first()
    await selectedRow.hover()
    await selectedRow.getByTestId('node-add-child').click()
  }
}
