import { expect, test as base } from '@playwright/test'
import { e2eEnv } from './utils/e2e-env-vars'
import { adminLogin, approveUser, login, logout, signup } from './utils'
import { randomUUID } from 'crypto'
import path from 'path'
import * as fs from 'fs'

const test = base.extend<{}, { workerStorageState: string }>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),
  workerStorageState: [
    async ({ browser, browserName }, use, workerInfo) => {
      const id = workerInfo.parallelIndex
      const dir = path.resolve(process.cwd(), 'playwright/.auth')

      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const fileName = path.join(dir, `user.${id}.json`)
      const page = await browser.newPage({
        baseURL: workerInfo.project.use.baseURL,
      })

      const user_suffix = randomUUID()
      const user = {
        name: `user_${user_suffix}`,
        mail: `user_${user_suffix}@example.com`,
        password: 'Password1!',
      }

      await signup(page, user.name, user.mail, user.password)
      await adminLogin(page)
      await approveUser(page, user.name)
      await logout(page)
      await login(page, user.name, user.password, true)

      await page.context().storageState({ path: fileName })
      await page.close()

      await use(fileName)
    },
    { scope: 'worker' },
  ],
})

test.describe.serial('Integrations', () => {
  test('Install openai integration', async ({ page }) => {
    await page.goto('/settings')

    const card = page.locator('[data-type="integration-card"][data-title-id="integration.openai.title"]')
    card.click()

    await expect(page.locator('[data-dialog-name="openai"]')).toBeVisible()

    const modelSelect = page.locator('[data-select-name="openai-model"]')

    await modelSelect.click()
    const options = page.locator('[role="option"]', { hasText: 'gpt-4o-mini' })
    await expect(options).toHaveCount(1)
    await options.first().click()

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()
    await Promise.all([
      page.waitForResponse(
        resp =>
          resp.url().includes('/api/v1/integration/openai/update') && resp.request().method() === 'PUT' && resp.ok(),
      ),
      page.waitForResponse(
        resp => resp.url().includes('/api/v1/integration') && resp.request().method() === 'GET' && resp.ok(),
      ),
    ])

    await expect(card).toBeVisible()
  })

  test('Install deepseek integration', async ({ page }) => {
    await page.goto('/settings')

    const addIntegrationButton = page.locator('[data-type="add-integration"]')
    await addIntegrationButton.click()

    const card = page.locator('[data-type="integration-card"][data-title-id="integration.deepseek.title"]')
    card.click()

    await expect(page.locator('[data-dialog-name="deepseek"]')).toBeVisible()

    const modelSelect = page.locator('[data-select-name="deepseek-model"]')
    await modelSelect.click()
    const options = page.locator('[role="option"]')
    options.first().click()

    const apiKeyInput = page.locator('#apiKey')
    await apiKeyInput.click()
    await apiKeyInput.fill(e2eEnv.E2E_DEEPSEEK_API_KEY)

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    await Promise.all([
      page.waitForResponse(
        resp =>
          resp.url().includes('/api/v1/integration/deepseek/update') && resp.request().method() === 'PUT' && resp.ok(),
      ),
      page.waitForResponse(
        resp => resp.url().includes('/api/v1/integration') && resp.request().method() === 'GET' && resp.ok(),
      ),
    ])

    await expect(card).toBeVisible()
  })

  test('Install qwen integration', async ({ page }) => {
    await page.goto('/settings')

    const addIntegrationButton = page.locator('[data-type="add-integration"]')
    await addIntegrationButton.click()

    const card = page.locator('[data-type="integration-card"][data-title-id="integration.qwen.title"]')
    card.click()

    await expect(page.locator('[data-dialog-name="qwen"]')).toBeVisible()

    const modelSelect = page.locator('[data-select-name="qwen-model"]')
    await modelSelect.click()

    const option = page.locator('[role="option"]', { hasText: 'qwen-turbo' })
    await option.click()

    const apiKeyInput = page.locator('#apiKey')
    await apiKeyInput.click()
    await apiKeyInput.fill(e2eEnv.E2E_QWEN_API_KEY)

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    await Promise.all([
      page.waitForResponse(
        resp =>
          resp.url().includes('/api/v1/integration/qwen/update') && resp.request().method() === 'PUT' && resp.ok(),
      ),
      page.waitForResponse(
        resp => resp.url().includes('/api/v1/integration') && resp.request().method() === 'GET' && resp.ok(),
      ),
    ])

    await expect(card).toBeVisible()
  })

  test('Install claude integration', async ({ page }) => {
    await page.goto('/settings')

    const addIntegrationButton = page.locator('[data-type="add-integration"]')
    await addIntegrationButton.click()

    const card = page.locator('[data-type="integration-card"][data-title-id="integration.claude.title"]')
    card.click()

    await expect(page.locator('[data-dialog-name="claude"]')).toBeVisible()

    const modelSelect = page.locator('[data-select-name="claude-model"]')
    await modelSelect.click()
    const options = page.locator('[role="option"]')
    options.first().click()

    const apiKeyInput = page.locator('#apiKey')
    await apiKeyInput.click()
    await apiKeyInput.fill(e2eEnv.E2E_CLAUDE_API_KEY)

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    await Promise.all([
      page.waitForResponse(
        resp =>
          resp.url().includes('/api/v1/integration/claude/update') && resp.request().method() === 'PUT' && resp.ok(),
      ),
      page.waitForResponse(
        resp => resp.url().includes('/api/v1/integration') && resp.request().method() === 'GET' && resp.ok(),
      ),
    ])

    await expect(card).toBeVisible()
  })

  test('Install perplexity integration', async ({ page }) => {
    await page.goto('/settings')

    const addIntegrationButton = page.locator('[data-type="add-integration"]')
    await addIntegrationButton.click()

    const card = page.locator('[data-type="integration-card"][data-title-id="integration.perplexity.title"]')
    card.click()

    await expect(page.locator('[data-dialog-name="perplexity"]')).toBeVisible()

    const modelSelect = page.locator('[data-select-name="perplexity-model"]')
    await modelSelect.click()
    const options = page.locator('[role="option"]')
    options.first().click()

    const apiKeyInput = page.locator('#apiKey')
    await apiKeyInput.click()
    await apiKeyInput.fill(e2eEnv.E2E_PERPLEXITY_API_KEY)

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    await Promise.all([
      page.waitForResponse(
        resp =>
          resp.url().includes('/api/v1/integration/perplexity/update') &&
          resp.request().method() === 'PUT' &&
          resp.ok(),
        { timeout: 30000 },
      ),
      page.waitForResponse(
        resp => resp.url().includes('/api/v1/integration') && resp.request().method() === 'GET' && resp.ok(),
        { timeout: 30000 },
      ),
    ])

    await expect(card).toBeVisible()
  })

  test('Install yandex integration', async ({ page }) => {
    await page.goto('/settings')

    const addIntegrationButton = page.locator('[data-type="add-integration"]')
    await addIntegrationButton.click()

    const card = page.locator('[data-type="integration-card"][data-title-id="integration.yandex.title"]')
    card.click()

    await expect(page.locator('[data-dialog-name="yandex"]')).toBeVisible()

    const modelSelect = page.locator('[data-select-name="yandex-model"]')
    await modelSelect.click()
    const options = page.locator('[role="option"]')
    options.first().click()

    const apiKeyInput = page.locator('#apiKey')
    await apiKeyInput.click()
    await apiKeyInput.fill(e2eEnv.E2E_YANDEX_API_KEY)

    const folderIdInput = page.locator('#folder_id')
    await folderIdInput.click()
    await folderIdInput.fill(e2eEnv.E2E_YANDEX_FOLDER_ID)

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    await Promise.all([
      page.waitForResponse(
        resp =>
          resp.url().includes('/api/v1/integration/yandex/update') && resp.request().method() === 'PUT' && resp.ok(),
      ),
      page.waitForResponse(
        resp => resp.url().includes('/api/v1/integration') && resp.request().method() === 'GET' && resp.ok(),
      ),
    ])

    await expect(card).toBeVisible()
  })

  test('Install custom_llm integration', async ({ page }) => {
    await page.goto('/settings')

    const addIntegrationButton = page.locator('[data-type="add-integration"]')
    await addIntegrationButton.click()

    const card = page.locator('[data-type="integration-card"][data-title-id="integration.custom_llm.title"]')
    card.click()

    await expect(page.locator('[data-dialog-name="custom_llm"]')).toBeVisible()

    const modelSelect = page.locator('[data-select-name="custom_llm-model"]')
    await modelSelect.click()
    const options = page.locator('[role="option"]')
    options.first().click()

    const apiRootInput = page.locator('#apiRootUrl')
    await apiRootInput.click()
    await apiRootInput.fill(e2eEnv.E2E_CUSTOM_LLM_URL)

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    await Promise.all([
      page.waitForResponse(
        resp =>
          resp.url().includes('/api/v1/integration/custom_llm/update') &&
          resp.request().method() === 'PUT' &&
          resp.ok(),
      ),
      page.waitForResponse(
        resp => resp.url().includes('/api/v1/integration') && resp.request().method() === 'GET' && resp.ok(),
      ),
    ])

    await expect(card).toBeVisible()
  })
})
