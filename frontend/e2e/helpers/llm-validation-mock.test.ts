import { test, expect, type Page } from '@playwright/test'
import {
  mockLLMValidation,
  mockAllLLMValidations,
  unmockLLMValidation,
  unmockAllLLMValidations,
} from './llm-validation-mock'

const QWEN_EXTERNAL_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'

async function postJson(page: Page, url: string): Promise<any> {
  return page.evaluate(
    (u: string) =>
      fetch(u, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json()),
    url,
  )
}

test.describe('LLM Validation Mock Helper', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('response format contracts', () => {
    test('OpenAI-compatible response: choices array with message content and completion metadata', async ({ page }) => {
      await mockLLMValidation(page, { provider: 'deepseek' })
      const response = await postJson(page, '/api/v2/integration/deepseek/chat/completions')
      expect(response.object).toBe('chat.completion')
      expect(response.choices[0].message.content).toBe('Hello!')
      expect(response.choices[0].finish_reason).toBe('stop')
    })

    test('Claude/Anthropic response: content array with text and stop_reason', async ({ page }) => {
      await mockLLMValidation(page, { provider: 'claude' })
      const response = await postJson(page, '/api/v2/integration/claude/messages')
      expect(response.type).toBe('message')
      expect(response.role).toBe('assistant')
      expect(response.content[0].text).toBe('Hello!')
      expect(response.stop_reason).toBe('end_turn')
    })

    test('YandexGPT response: result.alternatives with ALTERNATIVE_STATUS_FINAL status', async ({ page }) => {
      await mockLLMValidation(page, { provider: 'yandex' })
      const response = await postJson(page, '/api/v2/integration/yandex/completion')
      expect(response.result.alternatives[0].message.text).toBe('Hello!')
      expect(response.result.alternatives[0].status).toBe('ALTERNATIVE_STATUS_FINAL')
    })
  })

  test.describe('route registration', () => {
    test('openai routes to the shared /integration/chat/completions endpoint without a provider URL segment', async ({
      page,
    }) => {
      await mockLLMValidation(page, { provider: 'openai' })
      const response = await postJson(page, '/api/v2/integration/chat/completions')
      expect(response.choices[0].message.content).toBe('Hello!')
    })

    test('qwen routes to the external Dashscope API domain instead of the backend proxy', async ({ page }) => {
      await mockLLMValidation(page, { provider: 'qwen' })
      const response = await postJson(page, QWEN_EXTERNAL_URL)
      expect(response.choices[0].message.content).toBe('Hello!')
    })
  })

  test.describe('custom response text', () => {
    test('mockLLMValidation accepts custom response text for any provider', async ({ page }) => {
      await mockLLMValidation(page, { provider: 'perplexity', mockResponse: 'Custom text' })
      const response = await postJson(page, '/api/v2/integration/perplexity/chat/completions')
      expect(response.choices[0].message.content).toBe('Custom text')
    })

    test('mockAllLLMValidations propagates custom response text to all format families', async ({ page }) => {
      await mockAllLLMValidations(page, 'Broadcast')
      const openai = await postJson(page, '/api/v2/integration/chat/completions')
      const claude = await postJson(page, '/api/v2/integration/claude/messages')
      const yandex = await postJson(page, '/api/v2/integration/yandex/completion')
      expect(openai.choices[0].message.content).toBe('Broadcast')
      expect(claude.content[0].text).toBe('Broadcast')
      expect(yandex.result.alternatives[0].message.text).toBe('Broadcast')
    })
  })

  test.describe('mockAllLLMValidations', () => {
    test('covers all 7 providers with their correct endpoints and format shapes', async ({ page }) => {
      await mockAllLLMValidations(page)

      const scenarios: Array<{ endpoint: string; extract: (r: any) => string }> = [
        { endpoint: '/api/v2/integration/chat/completions', extract: r => r.choices[0].message.content },
        { endpoint: '/api/v2/integration/deepseek/chat/completions', extract: r => r.choices[0].message.content },
        { endpoint: '/api/v2/integration/perplexity/chat/completions', extract: r => r.choices[0].message.content },
        { endpoint: '/api/v2/integration/custom_llm/chat/completions', extract: r => r.choices[0].message.content },
        { endpoint: QWEN_EXTERNAL_URL, extract: r => r.choices[0].message.content },
        { endpoint: '/api/v2/integration/claude/messages', extract: r => r.content[0].text },
        { endpoint: '/api/v2/integration/yandex/completion', extract: r => r.result.alternatives[0].message.text },
      ]

      for (const { endpoint, extract } of scenarios) {
        const response = await postJson(page, endpoint)
        expect(extract(response)).toBe('Mock response')
      }
    })
  })

  test.describe('unmock lifecycle', () => {
    test('unmockLLMValidation removes the route so subsequent requests are no longer intercepted', async ({ page }) => {
      await mockLLMValidation(page, { provider: 'deepseek', mockResponse: 'Mocked' })
      const mocked = await postJson(page, '/api/v2/integration/deepseek/chat/completions')
      expect(mocked.choices[0].message.content).toBe('Mocked')

      await unmockLLMValidation(page, { provider: 'deepseek' })

      await page.route('**/api/v2/integration/deepseek/chat/completions', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ choices: [{ message: { content: 'Passthrough' } }] }),
        }),
      )
      const passthrough = await postJson(page, '/api/v2/integration/deepseek/chat/completions')
      expect(passthrough.choices[0].message.content).toBe('Passthrough')
    })

    test('unmockAllLLMValidations removes all provider routes', async ({ page }) => {
      await mockAllLLMValidations(page, 'Mocked')
      const mocked = await postJson(page, '/api/v2/integration/claude/messages')
      expect(mocked.content[0].text).toBe('Mocked')

      await unmockAllLLMValidations(page)

      await page.route('**/api/v2/integration/claude/messages', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: [{ text: 'Passthrough' }] }),
        }),
      )
      const passthrough = await postJson(page, '/api/v2/integration/claude/messages')
      expect(passthrough.content[0].text).toBe('Passthrough')
    })
  })

  test.describe('mock composition', () => {
    test('sequential mocks on the same provider: last registration wins', async ({ page }) => {
      await mockLLMValidation(page, { provider: 'openai', mockResponse: 'First' })
      await mockLLMValidation(page, { provider: 'openai', mockResponse: 'Second' })
      const response = await postJson(page, '/api/v2/integration/chat/completions')
      expect(response.choices[0].message.content).toBe('Second')
    })

    test('concurrent mocks on different providers are independent', async ({ page }) => {
      await Promise.all([
        mockLLMValidation(page, { provider: 'openai', mockResponse: 'OpenAI' }),
        mockLLMValidation(page, { provider: 'claude', mockResponse: 'Claude' }),
        mockLLMValidation(page, { provider: 'deepseek', mockResponse: 'Deepseek' }),
      ])
      const [openai, claude, deepseek] = await Promise.all([
        postJson(page, '/api/v2/integration/chat/completions'),
        postJson(page, '/api/v2/integration/claude/messages'),
        postJson(page, '/api/v2/integration/deepseek/chat/completions'),
      ])
      expect(openai.choices[0].message.content).toBe('OpenAI')
      expect(claude.content[0].text).toBe('Claude')
      expect(deepseek.choices[0].message.content).toBe('Deepseek')
    })
  })

  test.describe('error handling', () => {
    test('mockLLMValidation throws for an unregistered provider', async ({ page }) => {
      await expect(mockLLMValidation(page, { provider: 'nonexistent' as any })).rejects.toThrow(
        'Unsupported LLM provider: nonexistent',
      )
    })

    test('unmockLLMValidation is a no-op for an unregistered provider', async ({ page }) => {
      await expect(unmockLLMValidation(page, { provider: 'nonexistent' as any })).resolves.toBeUndefined()
    })
  })
})
