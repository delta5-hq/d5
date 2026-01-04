import type { Locator, Page } from '@playwright/test'

export interface LocatorConfig {
  testId?: string
  role?: string
  name?: string
  selector?: string
}

export class LocatorBuilder {
  constructor(private readonly page: Page) {}

  byTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`)
  }

  byRole(role: string, name?: string): Locator {
    return name ? this.page.getByRole(role as any, { name }) : this.page.getByRole(role as any)
  }

  bySelector(selector: string): Locator {
    return this.page.locator(selector)
  }

  build(config: LocatorConfig): Locator {
    if (config.testId) {
      return this.byTestId(config.testId)
    }
    if (config.role && config.name) {
      return this.byRole(config.role, config.name)
    }
    if (config.role) {
      return this.byRole(config.role)
    }
    if (config.selector) {
      return this.bySelector(config.selector)
    }
    throw new Error('Invalid locator config: must provide testId, role, or selector')
  }
}

export function createLocatorBuilder(page: Page): LocatorBuilder {
  return new LocatorBuilder(page)
}
