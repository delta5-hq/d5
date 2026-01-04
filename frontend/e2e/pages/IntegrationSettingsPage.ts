import { type Page, type Locator, expect } from '@playwright/test'

const SELECTORS = {
  integrationCard: '[data-type="integration-card"]',
  addIntegrationButton: '[data-type="add-integration"]',
  submitButton: 'button[type="submit"]',
  apiKeyInput: '#apiKey',
  folderIdInput: '#folder_id',
  apiRootUrlInput: '#apiRootUrl',
  optionRole: '[role="option"]',
  installedIntegrationCard: '[data-type="installed-integration-card"]',
  deleteIntegrationButton: '[data-action="delete-integration"]',
} as const

const API_ENDPOINTS = {
  integrationUpdate: (service: string) => `/api/v2/integration/${service}/update`,
  integrationGet: '/api/v2/integration',
} as const

const TIMEOUTS = {
  dialogAppear: 10000,
  apiResponse: 30000,
  dialogClose: 10000,
} as const

export interface IntegrationConfig {
  apiKey?: string
  model?: string
  modelText?: string
  folderId?: string
  apiRootUrl?: string
}

export class IntegrationSettingsPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/settings')
  }



  async isIntegrationDialogOpen(): Promise<boolean> {
    return (await this.page.locator(SELECTORS.integrationCard).count()) > 0
  }

  async openIntegrationDialog() {
    const isOpen = await this.isIntegrationDialogOpen()
    
    if (!isOpen) {
      await this.page.locator(SELECTORS.addIntegrationButton).click()
      await this.page.waitForSelector(SELECTORS.integrationCard, { timeout: TIMEOUTS.dialogAppear })
    }
  }

  async selectIntegration(titleId: string): Promise<Locator> {
    await this.openIntegrationDialog()
    
    const dialog = this.page.locator('[role="dialog"]')
    const card = dialog.locator(`${SELECTORS.integrationCard}[data-title-id="${titleId}"]`)
    await card.click()
    return card
  }

  async verifyDialogVisible(serviceName: string) {
    await expect(this.page.locator(`[data-dialog-name="${serviceName}"]`)).toBeVisible()
  }

  async fillApiKey(apiKey: string) {
    const input = this.page.locator(SELECTORS.apiKeyInput)
    await input.click()
    await input.fill(apiKey)
  }

  async fillFolderId(folderId: string) {
    const input = this.page.locator(SELECTORS.folderIdInput)
    await input.click()
    await input.fill(folderId)
  }

  async fillApiRootUrl(url: string) {
    const input = this.page.locator(SELECTORS.apiRootUrlInput)
    await input.click()
    await input.fill(url)
  }

  async selectModel(serviceName: string, modelText?: string): Promise<Locator> {
    const modelSelect = this.page.locator(`[data-select-name="${serviceName}-model"]`)
    await modelSelect.waitFor({ state: 'visible', timeout: 5000 })
    await modelSelect.click()
    
    const options = modelText 
      ? this.page.locator(SELECTORS.optionRole, { hasText: modelText })
      : this.page.locator(SELECTORS.optionRole)
    
    await options.first().click()
    return options
  }

  async submitIntegration(serviceName: string) {
    const submitButton = this.page.locator(SELECTORS.submitButton)
    
    await Promise.all([
      this.page.waitForResponse(
        resp => resp.url().includes(API_ENDPOINTS.integrationUpdate(serviceName)) && 
                resp.request().method() === 'PUT' && 
                resp.ok(),
        { timeout: TIMEOUTS.apiResponse }
      ),
      this.page.waitForResponse(
        resp => resp.url().includes(API_ENDPOINTS.integrationGet) && 
                resp.request().method() === 'GET' && 
                resp.ok(),
        { timeout: TIMEOUTS.apiResponse }
      ),
      submitButton.click(),
    ])
  }

  async installIntegration(
    titleId: string,
    serviceName: string,
    config: IntegrationConfig
  ): Promise<Locator> {
    await this.goto()
    
    await this.page.evaluate(async (service) => {
      await fetch(`/api/v2/integration/${service}/delete`, { method: 'DELETE', credentials: 'include' })
      await fetch('/api/v2/integration', { method: 'GET', credentials: 'include' })
    }, serviceName)
    await this.page.waitForTimeout(500)
    await this.page.reload()
    
    const card = await this.selectIntegration(titleId)
    await this.verifyDialogVisible(serviceName)

    if (config.apiKey) {
      await this.fillApiKey(config.apiKey)
    }

    if (config.folderId) {
      await this.fillFolderId(config.folderId)
    }

    if (config.apiRootUrl) {
      await this.fillApiRootUrl(config.apiRootUrl)
    }

    if (config.model !== undefined || config.modelText !== undefined) {
      await this.selectModel(serviceName, config.modelText)
    }

    await this.submitIntegration(serviceName)
    
    await this.page.waitForSelector(`[data-dialog-name="${serviceName}"]`, { state: 'hidden', timeout: TIMEOUTS.dialogClose })
    
    const installedCard = this.page.locator(`[data-type="integration-card"][data-title-id="${titleId}"]`).first()
    await expect(installedCard).toBeVisible()

    return installedCard
  }
}
