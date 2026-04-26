import { type Page, type Locator, expect } from '@playwright/test'
import { selectRadixOption } from '../helpers/radix-select-helper'

const TIMEOUTS = {
  dialogAppear: 10000,
  apiResponse: 45000,
  dialogClose: 10000,
  cardAppear: 10000,
} as const

const SELECTORS = {
  addButton: (fieldName: string) => `[data-type="add-${fieldName}"]`,
  integrationCard: (alias: string) => `[data-alias="${alias}"]`,
  dialogContent: (dialogName: string) => `[data-dialog-name="${dialogName}"]`,
  submitButton: 'button[type="submit"]',
  cancelButton: 'button:has-text("Cancel")',
} as const

const API_ENDPOINTS = {
  getIntegration: '/api/v2/integration',
} as const

export interface MCPIntegrationData {
  alias: string
  transport: 'stdio' | 'streamable-http'
  toolName: string
  toolInputField?: string
  description?: string
  timeoutMs?: number
  command?: string
  args?: string
  serverUrl?: string
}

export interface RPCIntegrationData {
  alias: string
  protocol: 'ssh' | 'http' | 'acp-local'
  description?: string
  timeoutMs?: number
  host?: string
  port?: number
  username?: string
  privateKey?: string
  passphrase?: string
  commandTemplate?: string
  workingDir?: string
  url?: string
  method?: 'GET' | 'POST' | 'PUT'
  headers?: string
  bodyTemplate?: string
  command?: string
  args?: string
  env?: string
  outputFormat?: 'text' | 'json'
  outputField?: string
  sessionIdField?: string
  autoApprove?: 'all' | 'none' | 'whitelist'
  allowedTools?: string
}

export class ArrayIntegrationPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/settings')
    await this.page.waitForLoadState('networkidle')
    // At mobile viewports the settings page shows Profile/Integrations tabs with Profile
    // selected by default. Click the Integrations tab so the integration section is visible.
    const integrationsTab = this.page.locator('[role="tab"]:has-text("Integrations")')
    if (await integrationsTab.count() > 0) {
      await integrationsTab.click()
    }
  }

  async openAddDialog(fieldName: 'mcp' | 'rpc'): Promise<void> {
    const addButton = this.page.locator(SELECTORS.addButton(fieldName))
    await addButton.waitFor({ state: 'visible', timeout: TIMEOUTS.dialogAppear })
    await addButton.click()

    await this.page.waitForSelector(SELECTORS.dialogContent(fieldName), {
      state: 'visible',
      timeout: TIMEOUTS.dialogAppear,
    })
  }

  async fillMCPForm(data: MCPIntegrationData): Promise<void> {
    const dialogScope = this.page.locator(SELECTORS.dialogContent('mcp'))

    await this.page.locator('#alias').fill(data.alias)
    await this.selectOption(/stdio|streamable-http/i, data.transport, dialogScope)
    await this.page.locator('#toolName').fill(data.toolName)

    if (data.toolInputField !== undefined) {
      await this.page.locator('#toolInputField').fill(data.toolInputField)
    }

    if (data.description !== undefined) {
      await this.page.locator('#description').fill(data.description)
    }

    if (data.transport === 'stdio' && data.command) {
      await this.page.locator('#command').fill(data.command)

      if (data.args !== undefined) {
        await this.page.locator('#args').fill(data.args)
      }
    } else if (data.transport === 'streamable-http' && data.serverUrl) {
      await this.page.locator('#serverUrl').fill(data.serverUrl)
    }

    if (data.timeoutMs !== undefined) {
      await this.page.locator('#timeoutMs').fill(String(data.timeoutMs))
    }
  }

  async fillRPCForm(data: RPCIntegrationData): Promise<void> {
    const dialogScope = this.page.locator(SELECTORS.dialogContent('rpc'))

    await this.page.locator('#alias').fill(data.alias)
    await this.selectOption(/ssh|http|acp-local/i, data.protocol.toUpperCase(), dialogScope)

    if (data.description !== undefined) {
      await this.page.locator('#description').fill(data.description)
    }

    if (data.protocol === 'ssh') {
      if (data.host) await this.page.locator('#host').fill(data.host)
      if (data.port !== undefined) await this.page.locator('#port').fill(String(data.port))
      if (data.username) await this.page.locator('#username').fill(data.username)
      if (data.privateKey) await this.page.locator('#privateKey').fill(data.privateKey)
      if (data.passphrase) await this.page.locator('#passphrase').fill(data.passphrase)
      if (data.commandTemplate) await this.page.locator('#commandTemplate').fill(data.commandTemplate)
      if (data.workingDir) await this.page.locator('#workingDir').fill(data.workingDir)
      if (data.outputFormat) await this.selectOption(/text|json/i, data.outputFormat.toUpperCase(), dialogScope)
      if (data.outputField) await this.page.locator('#outputField').fill(data.outputField)
      if (data.sessionIdField) await this.page.locator('#sessionIdField').fill(data.sessionIdField)
    } else if (data.protocol === 'http') {
      if (data.url) await this.page.locator('#url').fill(data.url)
      if (data.method) await this.selectOption(/GET|POST|PUT/i, data.method, dialogScope)
      if (data.headers) await this.page.locator('#headers').fill(data.headers)
      if (data.bodyTemplate) await this.page.locator('#bodyTemplate').fill(data.bodyTemplate)
      if (data.outputFormat) await this.selectOption(/text|json/i, data.outputFormat.toUpperCase(), dialogScope)
      if (data.outputField) await this.page.locator('#outputField').fill(data.outputField)
      if (data.sessionIdField) await this.page.locator('#sessionIdField').fill(data.sessionIdField)
    } else if (data.protocol === 'acp-local') {
      if (data.command) await this.page.locator('#command').fill(data.command)
      if (data.args) await this.page.locator('#args').fill(data.args)
      if (data.env) await this.page.locator('#env').fill(data.env)
      if (data.workingDir) await this.page.locator('#workingDir').fill(data.workingDir)
      if (data.autoApprove) await this.selectOption(/all|none|whitelist/i, data.autoApprove, dialogScope)
      if (data.allowedTools) await this.page.locator('#allowedTools').fill(data.allowedTools)
    }

    if (data.timeoutMs !== undefined) {
      await this.page.locator('#timeoutMs').fill(String(data.timeoutMs))
    }
  }

  async submitDialog(fieldName: 'mcp' | 'rpc', isEdit = false): Promise<void> {
    const submitButton = this.page.locator(SELECTORS.submitButton)
    const dialog = this.page.locator(SELECTORS.dialogContent(fieldName))

    await submitButton.click()

    await dialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialogClose })

    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.apiResponse })
  }

  async cancelDialog(): Promise<void> {
    await this.page.locator(SELECTORS.cancelButton).click()
  }

  async addMCPIntegration(data: MCPIntegrationData): Promise<Locator> {
    await this.openAddDialog('mcp')
    await this.fillMCPForm(data)
    await this.submitDialog('mcp', false)

    const card = this.page.locator(SELECTORS.integrationCard(data.alias)).first()
    await expect(card).toBeVisible({ timeout: TIMEOUTS.cardAppear })
    return card
  }

  async addRPCIntegration(data: RPCIntegrationData): Promise<Locator> {
    await this.openAddDialog('rpc')
    await this.fillRPCForm(data)
    await this.submitDialog('rpc', false)

    const card = this.page.locator(SELECTORS.integrationCard(data.alias)).first()
    await expect(card).toBeVisible({ timeout: TIMEOUTS.cardAppear })
    return card
  }

  async openEditDialog(alias: string): Promise<void> {
    const card = this.page.locator(SELECTORS.integrationCard(alias))
    await card.waitFor({ state: 'visible', timeout: TIMEOUTS.cardAppear })

    await card.click()
  }

  async editMCPIntegration(alias: string, updates: Partial<MCPIntegrationData>): Promise<void> {
    await this.openEditDialog(alias)

    await this.page.waitForSelector(SELECTORS.dialogContent('mcp'), {
      state: 'visible',
      timeout: TIMEOUTS.dialogAppear,
    })

    if (updates.description !== undefined) {
      const descField = this.page.locator('#description')
      await descField.clear()
      await descField.fill(updates.description)
    }

    if (updates.timeoutMs !== undefined) {
      const timeoutField = this.page.locator('#timeoutMs')
      await timeoutField.clear()
      await timeoutField.fill(String(updates.timeoutMs))
    }

    await this.submitDialog('mcp', true)
  }

  async editRPCIntegration(alias: string, updates: Partial<RPCIntegrationData>): Promise<void> {
    await this.openEditDialog(alias)

    await this.page.waitForSelector(SELECTORS.dialogContent('rpc'), {
      state: 'visible',
      timeout: TIMEOUTS.dialogAppear,
    })

    if (updates.description !== undefined) {
      const descField = this.page.locator('#description')
      await descField.clear()
      await descField.fill(updates.description)
    }

    if (updates.headers !== undefined) {
      const headersField = this.page.locator('#headers')
      await headersField.clear()
      await headersField.fill(updates.headers)
    }

    await this.submitDialog('rpc', true)
  }

  async deleteIntegration(alias: string, fieldName: 'mcp' | 'rpc'): Promise<void> {
    const card = this.page.locator(`[data-alias="${alias}"][data-field="${fieldName}"]`)
    await card.waitFor({ state: 'visible', timeout: TIMEOUTS.cardAppear })

    const deleteButton = card.locator(`button[aria-label="Delete ${alias}"]`)
    await deleteButton.click()

    const confirmDialog = this.page.locator('role=dialog').filter({ hasText: 'Are you sure you want to delete' })
    await confirmDialog.waitFor({ state: 'visible', timeout: TIMEOUTS.cardAppear })

    const confirmButton = confirmDialog.locator('button:has-text("Delete")')
    await confirmButton.click()

    await confirmDialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialogClose })
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.apiResponse })
    await card.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialogClose })
  }

  async verifyCardVisible(alias: string): Promise<Locator> {
    const card = this.page.locator(SELECTORS.integrationCard(alias)).first()
    await expect(card).toBeVisible({ timeout: TIMEOUTS.cardAppear })
    return card
  }

  async verifyCardNotVisible(alias: string): Promise<void> {
    const card = this.page.locator(SELECTORS.integrationCard(alias))
    await expect(card).not.toBeVisible({ timeout: TIMEOUTS.cardAppear })
  }

  async verifyCardDescription(alias: string, description: string): Promise<void> {
    const card = this.page.locator(SELECTORS.integrationCard(alias))
    await expect(card).toContainText(description)
  }

  private async selectOption(
    currentTextPattern: RegExp,
    optionText: string,
    scope?: Locator,
  ): Promise<void> {
    await selectRadixOption(this.page, {
      triggerTextPattern: currentTextPattern,
      optionText,
      triggerScope: scope,
    })
  }
}
