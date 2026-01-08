import type { Page } from '@playwright/test'

export interface PageObjectBase {
  readonly page: Page
}

export abstract class BasePage implements PageObjectBase {
  constructor(readonly page: Page) {}

  protected async waitForElement(
    selector: string,
    options: { state?: 'visible' | 'hidden'; timeout?: number } = {}
  ): Promise<void> {
    const { state = 'visible', timeout = 5000 } = options
    await this.page.locator(selector).waitFor({ state, timeout })
  }

  protected async safeClick(selector: string): Promise<void> {
    await this.waitForElement(selector)
    await this.page.locator(selector).click()
  }

  async isVisible(selector: string): Promise<boolean> {
    try {
      return await this.page.locator(selector).isVisible()
    } catch {
      return false
    }
  }

  async count(selector: string): Promise<number> {
    return await this.page.locator(selector).count()
  }
}

export abstract class PageComponent extends BasePage {
  abstract get rootSelector(): string

  get root() {
    return this.page.locator(this.rootSelector)
  }

  async isComponentVisible(): Promise<boolean> {
    return this.isVisible(this.rootSelector)
  }

  async waitForComponent(state: 'visible' | 'hidden' = 'visible'): Promise<void> {
    await this.waitForElement(this.rootSelector, { state })
  }
}
