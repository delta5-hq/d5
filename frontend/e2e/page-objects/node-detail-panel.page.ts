import type { Locator } from '@playwright/test'
import { PageComponent } from '../helpers/base-page'

export class NodeDetailPanelPage extends PageComponent {
  get rootSelector(): string {
    return '[data-testid="node-detail-panel"]'
  }

  get executeButton(): Locator {
    return this.page.getByTestId('execute-node-button')
  }

  get addChildButton(): Locator {
    return this.page.getByTestId('add-child-node-button')
  }

  async execute(): Promise<void> {
    await this.executeButton.click()
  }

  async addChild(): Promise<void> {
    await this.addChildButton.click()
  }
}
