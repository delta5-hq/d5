import type { Page, Route } from '@playwright/test'

type LLMProvider = 'openai' | 'deepseek' | 'claude' | 'qwen' | 'yandex' | 'perplexity' | 'custom_llm'

interface LLMValidationMockOptions {
  provider: LLMProvider
  mockResponse?: string
}

interface LLMEndpointConfig {
  backendProxy?: string
  externalAPI?: string
}

const ENDPOINT_MAP: Record<LLMProvider, LLMEndpointConfig> = {
  openai: { backendProxy: '**/api/v2/integration/openai/chat/completions' },
  deepseek: { backendProxy: '**/api/v2/integration/deepseek/chat/completions', externalAPI: '**/api.deepseek.com/**' },
  claude: { backendProxy: '**/api/v2/integration/claude/messages', externalAPI: '**/api.anthropic.com/**' },
  qwen: { backendProxy: '**/api/v2/integration/qwen/chat/completions', externalAPI: '**/dashscope.aliyuncs.com/**' },
  yandex: { backendProxy: '**/api/v2/integration/yandex/completion', externalAPI: '**/llm.api.cloud.yandex.net/**' },
  perplexity: { backendProxy: '**/api/v2/integration/perplexity/chat/completions', externalAPI: '**/api.perplexity.ai/**' },
  custom_llm: { backendProxy: '**/api/v2/integration/custom_llm/chat/completions' },
}

function createMockResponse(provider: LLMProvider, mockResponse: string): object {
  if (provider === 'claude') {
    return {
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: mockResponse }],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 20 },
    }
  }

  if (provider === 'yandex') {
    return {
      result: {
        alternatives: [
          {
            message: { role: 'assistant', text: mockResponse },
            status: 'ALTERNATIVE_STATUS_FINAL',
          },
        ],
        usage: { inputTextTokens: '10', completionTokens: '20', totalTokens: '30' },
        modelVersion: '1.0',
      },
    }
  }

  return {
    id: 'chatcmpl-mock',
    object: 'chat.completion',
    created: Date.now(),
    model: provider === 'qwen' ? 'qwen-turbo' : `${provider}-mock`,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: mockResponse },
        finish_reason: 'stop',
      },
    ],
  }
}

/**
 * Mocks LLM API validation endpoints for E2E tests.
 *
 * Integration dialogs validate API keys with live LLM calls before saving.
 * This prevents test failures when using mock credentials.
 *
 * Supports both backend proxy routes (used by most providers) and external
 * API routes (for providers that bypass the backend).
 *
 * @example
 * // Mock single provider
 * await mockLLMValidation(page, { provider: 'deepseek' })
 *
 * @example
 * // Mock all providers at once
 * await mockAllLLMValidations(page)
 */
export async function mockLLMValidation(
  page: Page,
  { provider, mockResponse = 'Hello!' }: LLMValidationMockOptions,
): Promise<void> {
  const config = ENDPOINT_MAP[provider]
  if (!config) {
    throw new Error(`Unsupported LLM provider: ${provider}`)
  }

  const mockBody = JSON.stringify(createMockResponse(provider, mockResponse))
  const fulfillOptions = {
    status: 200,
    contentType: 'application/json',
    body: mockBody,
  }

  if (config.backendProxy) {
    await page.route(config.backendProxy, (route: Route) => route.fulfill(fulfillOptions))
  }

  if (config.externalAPI) {
    await page.route(config.externalAPI, (route: Route) => route.fulfill(fulfillOptions))
  }
}

/**
 * Mocks all LLM validation endpoints at once.
 * Use this in test setup (beforeEach) to enable any integration dialog to work.
 */
export async function mockAllLLMValidations(page: Page, mockResponse = 'Mock response'): Promise<void> {
  const providers: LLMProvider[] = ['openai', 'deepseek', 'claude', 'qwen', 'yandex', 'perplexity', 'custom_llm']
  await Promise.all(providers.map(provider => mockLLMValidation(page, { provider, mockResponse })))
}

/**
 * Removes LLM validation mock to allow real API calls.
 */
export async function unmockLLMValidation(page: Page, { provider }: Pick<LLMValidationMockOptions, 'provider'>): Promise<void> {
  const config = ENDPOINT_MAP[provider]
  if (!config) return

  if (config.backendProxy) {
    await page.unroute(config.backendProxy)
  }

  if (config.externalAPI) {
    await page.unroute(config.externalAPI)
  }
}

/**
 * Removes all LLM validation mocks.
 */
export async function unmockAllLLMValidations(page: Page): Promise<void> {
  const providers: LLMProvider[] = ['openai', 'deepseek', 'claude', 'qwen', 'yandex', 'perplexity', 'custom_llm']
  await Promise.all(providers.map(provider => unmockLLMValidation(page, { provider })))
}
