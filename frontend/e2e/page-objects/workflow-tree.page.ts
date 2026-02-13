import type { Page, Locator } from '@playwright/test'

export class WorkflowTreePage {
  constructor(readonly page: Page) {}

  get nodes(): Locator {
    return this.page.locator('[data-node-id]')
  }

  get firstNode(): Locator {
    return this.nodes.first()
  }

  node(nodeId: string): Locator {
    return this.page.locator(`[data-node-id="${nodeId}"]`)
  }

  nodeByTitle(title: string): Locator {
    return this.page.locator('[data-node-id]', { hasText: title })
  }

  nodesAtDepth(depth: number): Locator {
    return this.page.locator(`[data-node-depth="${depth}"]`)
  }

  async selectNode(nodeId: string): Promise<void> {
    await this.node(nodeId).click()
  }

  async rootNodeId(): Promise<string> {
    const id = await this.firstNode.getAttribute('data-node-id')
    if (!id) throw new Error('No root node found in tree')
    return id
  }
}
