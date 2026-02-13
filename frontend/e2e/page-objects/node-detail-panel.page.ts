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

  get childrenCount(): Locator {
    return this.page.getByTestId('node-children-count')
  }

  async execute(): Promise<void> {
    await this.executeButton.click()
  }

  async addChild(): Promise<void> {
    await this.addChildButton.click()
  }

  async getChildrenCount(): Promise<number> {
    const text = await this.childrenCount.textContent()
    return parseInt(text ?? '0', 10)
  }
}
