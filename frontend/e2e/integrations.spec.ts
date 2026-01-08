import { expect, test as base, type Page } from '@playwright/test'
import { e2eEnv } from './utils/e2e-env-vars'
import { adminLogin, approveUser, login, logout, signup } from './utils'
import { IntegrationSettingsPage } from './pages/IntegrationSettingsPage'
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

      await adminLogin(page)

      /* Clean all integrations for this worker before tests start */
      const services = ['openai', 'deepseek', 'qwen', 'claude', 'perplexity', 'yandex', 'custom_llm']
      for (const service of services) {
        await page.evaluate(async (svc) => {
          await fetch(`/api/v2/integration/${svc}/delete`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
        }, service)
      }

      await page.context().storageState({ path: fileName })
      await page.close()

      await use(fileName)
    },
    { scope: 'worker' },
  ],
})

test.describe.serial('Integrations', () => {
  test.beforeEach(async ({ page }) => {
    /* Delete ALL integrations before each test to ensure clean state */
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    
    const services = ['openai', 'deepseek', 'qwen', 'claude', 'perplexity', 'yandex', 'custom_llm']
    for (const service of services) {
      await page.evaluate(async (svc) => {
        await fetch(`/api/v2/integration/${svc}/delete`, { method: 'DELETE', credentials: 'include' })
      }, service)
    }
    
    await page.evaluate(() => fetch('/api/v2/integration', { method: 'GET', credentials: 'include' }))
    await page.waitForTimeout(500)
  })

  test.beforeEach(async ({ page }) => {
    await page.route('**/api.deepseek.com/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-deepseek',
          object: 'chat.completion',
          model: 'deepseek-chat',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Mock response' } }],
        }),
      })
    })
    
    await page.route('**/dashscope.aliyuncs.com/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-qwen',
          object: 'chat.completion',
          model: 'qwen-turbo',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Mock response' } }],
        }),
      })
    })
    
    await page.route('**/api.anthropic.com/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-claude',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Mock response' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      })
    })
    
    await page.route('**/api.perplexity.ai/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-perplexity',
          model: 'llama-3.1-sonar-small-128k-online',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Mock response' } }],
        }),
      })
    })
    
    await page.route('**/llm.api.cloud.yandex.net/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            alternatives: [{ message: { role: 'assistant', text: 'Mock response' }, status: 'ALTERNATIVE_STATUS_FINAL' }],
            usage: { inputTextTokens: '10', completionTokens: '20', totalTokens: '30' },
            modelVersion: '1.0',
          },
        }),
      })
    })
    
    /* Mock Custom LLM - matches any external URL with /v1/chat/completions pattern */
    await page.route('**/v1/chat/completions', route => {
      /* Only mock external URLs, not our backend */
      if (!route.request().url().includes('localhost')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'mock-custom-llm',
            object: 'chat.completion',
            model: 'custom-model',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Mock response' } }],
          }),
        })
      } else {
        route.continue()
      }
    })
  })

  test('Install openai integration', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.openai.title',
      'openai',
      {
        apiKey: e2eEnv.E2E_OPEN_API_KEY,
        modelText: 'gpt-4o',
      }
    )
  })

  test('Install openai integration without apiKey', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.openai.title',
      'openai',
      {
        modelText: 'gpt-4.1-mini',
      }
    )
  })

  test('Install deepseek integration', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.deepseek.title',
      'deepseek',
      {
        apiKey: e2eEnv.E2E_DEEPSEEK_API_KEY,
      },
    )
  })

  test('Install qwen integration', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.qwen.title',
      'qwen',
      {
        apiKey: e2eEnv.E2E_QWEN_API_KEY,
      },
    )
  })

  test('Install claude integration', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.claude.title',
      'claude',
      {
        apiKey: e2eEnv.E2E_CLAUDE_API_KEY,
      },
    )
  })

  test('Install perplexity integration', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.perplexity.title',
      'perplexity',
      {
        apiKey: e2eEnv.E2E_PERPLEXITY_API_KEY,
      },
    )
  })

  test('Install yandex integration', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.yandex.title',
      'yandex',
      {
        apiKey: e2eEnv.E2E_YANDEX_API_KEY,
        folderId: e2eEnv.E2E_YANDEX_FOLDER_ID,
        modelText: 'yandexgpt',
      },
    )
  })

  test('Install custom_llm integration', async ({ page }) => {
    
    const integrationPage = new IntegrationSettingsPage(page)
    
    await integrationPage.installIntegration(
      'integration.custom_llm.title',
      'custom_llm',
      {
        apiRootUrl: e2eEnv.E2E_CUSTOM_LLM_URL,
        modelText: undefined,
      }
    )
  })
})
