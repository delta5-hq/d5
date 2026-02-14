import type { Page, Locator } from '@playwright/test'
import { NodeDetailPanelPage } from './node-detail-panel.page'

export class WorkflowTreePage {
  constructor(readonly page: Page) {}

  get treePanel(): Locator {
    return this.page.getByTestId('workflow-tree-panel')
  }

  get nodes(): Locator {
    return this.page.locator('[data-node-id]')
  }

  get firstNode(): Locator {
    return this.nodes.first()
  }

  get selectedNodes(): Locator {
    return this.page.locator('[data-node-selected="true"]')
  }

  get confirmDialog(): Locator {
    return this.page.locator('[role="alertdialog"]')
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

  async ctrlClickNode(nodeId: string): Promise<void> {
    await this.node(nodeId).click({ modifiers: ['ControlOrMeta'] })
  }

  async shiftClickNode(nodeId: string): Promise<void> {
    await this.node(nodeId).click({ modifiers: ['Shift'] })
  }

  async pressDelete(): Promise<void> {
    await this.treePanel.press('Delete')
  }

  async pressBackspace(): Promise<void> {
    await this.treePanel.press('Backspace')
  }

  async rootNodeId(): Promise<string> {
    const id = await this.firstNode.getAttribute('data-node-id')
    if (!id) throw new Error('No root node found in tree')
    return id
  }

  async nodeIdAt(index: number): Promise<string> {
    const id = await this.nodes.nth(index).getAttribute('data-node-id')
    if (!id) throw new Error(`No node found at index ${index}`)
    return id
  }

  async toggleNodeExpand(nodeId: string): Promise<void> {
    await this.node(nodeId).getByTestId('node-toggle').click()
  }

  private async blurInlineEdit(): Promise<void> {
    await this.treePanel.press('Escape')
    await this.treePanel.locator('input').waitFor({ state: 'detached', timeout: 2000 })
  }

  async createRootAndChildren(
    childCount: number,
    timeout: number = 5000,
  ): Promise<{ rootId: string; childIds: string[] }> {
    const detail = new NodeDetailPanelPage(this.page)

    await this.page.getByTestId('create-first-node').click()
    await this.firstNode.waitFor({ state: 'visible', timeout })

    const rootId = await this.rootNodeId()
    await this.blurInlineEdit()

    const childIds: string[] = []
    for (let i = 0; i < childCount; i++) {
      await this.selectNode(rootId)
      await detail.waitForComponent()
      await detail.addChild()
      const newNode = this.nodes.nth(1 + i)
      await newNode.waitFor({ state: 'visible', timeout })
      await this.blurInlineEdit()

      const childId = await newNode.getAttribute('data-node-id')
      if (!childId) throw new Error(`Failed to create child ${i}`)
      childIds.push(childId)
    }

    return { rootId, childIds }
  }
}
