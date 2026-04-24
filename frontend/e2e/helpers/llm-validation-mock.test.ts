import { test, expect } from '@playwright/test'
import { mockLLMValidation, mockAllLLMValidations, unmockLLMValidation } from './llm-validation-mock'

test.describe('LLM Validation Mock Helper', () => {
  test('mockLLMValidation handles OpenAI format providers', async ({ page }) => {
    await page.goto('/')
    await mockLLMValidation(page, { provider: 'openai' })

    const response = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json())
    })

    expect(response.choices[0].message.content).toBe('Hello!')
    expect(response.object).toBe('chat.completion')
  })

  test('mockLLMValidation handles Claude format', async ({ page }) => {
    await page.goto('/')
    await mockLLMValidation(page, { provider: 'claude' })

    const response = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/claude/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json())
    })

    expect(response.type).toBe('message')
    expect(response.content[0].text).toBe('Hello!')
    expect(response.stop_reason).toBe('end_turn')
  })

  test('mockLLMValidation handles Yandex format', async ({ page }) => {
    await page.goto('/')
    await mockLLMValidation(page, { provider: 'yandex' })

    const response = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/yandex/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', text: 'test' }] }),
      }).then(r => r.json())
    })

    expect(response.result.alternatives[0].message.text).toBe('Hello!')
    expect(response.result.alternatives[0].status).toBe('ALTERNATIVE_STATUS_FINAL')
  })

  test('mockLLMValidation accepts custom response text', async ({ page }) => {
    await page.goto('/')
    await mockLLMValidation(page, { provider: 'deepseek', mockResponse: 'Custom mock response' })

    const response = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/deepseek/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json())
    })

    expect(response.choices[0].message.content).toBe('Custom mock response')
  })

  test('mockLLMValidation mocks both backend proxy and external API when both exist', async ({ page }) => {
    await page.goto('/')
    await mockLLMValidation(page, { provider: 'deepseek' })

    const backendResponse = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/deepseek/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json())
    })

    expect(backendResponse.choices[0].message.content).toBe('Hello!')
  })

  test('mockAllLLMValidations mocks all 7 providers at once', async ({ page }) => {
    await page.goto('/')
    await mockAllLLMValidations(page)

    const providers = [
      { name: 'openai', endpoint: '/api/v2/integration/openai/chat/completions', field: 'choices[0].message.content' },
      { name: 'deepseek', endpoint: '/api/v2/integration/deepseek/chat/completions', field: 'choices[0].message.content' },
      { name: 'qwen', endpoint: '/api/v2/integration/qwen/chat/completions', field: 'choices[0].message.content' },
      { name: 'perplexity', endpoint: '/api/v2/integration/perplexity/chat/completions', field: 'choices[0].message.content' },
      { name: 'custom_llm', endpoint: '/api/v2/integration/custom_llm/chat/completions', field: 'choices[0].message.content' },
      { name: 'claude', endpoint: '/api/v2/integration/claude/messages', field: 'content[0].text' },
      { name: 'yandex', endpoint: '/api/v2/integration/yandex/completion', field: 'result.alternatives[0].message.text' },
    ]

    for (const { name, endpoint, field } of providers) {
      const response = await page.evaluate(
        async ({ url }) => {
          return await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
          }).then(r => r.json())
        },
        { url: endpoint },
      )

      const fieldParts = field.split(/[\.\[\]]/).filter(Boolean)
      let value: any = response
      for (const part of fieldParts) {
        value = value[part]
      }

      expect(value).toBe('Mock response')
    }
  })

  test('unmockLLMValidation allows route to proceed normally', async ({ page }) => {
    await page.goto('/')
    
    await mockLLMValidation(page, { provider: 'deepseek', mockResponse: 'Mocked' })

    const mockedResponse = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/deepseek/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json())
    })
    expect(mockedResponse.choices[0].message.content).toBe('Mocked')

    await unmockLLMValidation(page, { provider: 'deepseek' })

    await page.route('**/api/v2/integration/deepseek/chat/completions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: 'Real backend' } }],
        }),
      })
    })

    const unmockedResponse = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/deepseek/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json())
    })

    expect(unmockedResponse.choices[0].message.content).toBe('Real backend')
  })

  test('mockLLMValidation throws error for unsupported provider', async ({ page }) => {
    await page.goto('/')

    await expect(
      mockLLMValidation(page, { provider: 'nonexistent' as any }),
    ).rejects.toThrow('Unsupported LLM provider: nonexistent')
  })

  test('unmockLLMValidation handles unsupported provider gracefully', async ({ page }) => {
    await page.goto('/')

    await expect(
      unmockLLMValidation(page, { provider: 'nonexistent' as any }),
    ).resolves.toBeUndefined()
  })

  test('multiple sequential mocks of same provider overwrite each other', async ({ page }) => {
    await page.goto('/')

    await mockLLMValidation(page, { provider: 'openai', mockResponse: 'First' })
    await mockLLMValidation(page, { provider: 'openai', mockResponse: 'Second' })

    const response = await page.evaluate(async () => {
      return await fetch('/api/v2/integration/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      }).then(r => r.json())
    })

    expect(response.choices[0].message.content).toBe('Second')
  })

  test('concurrent mocks of different providers do not interfere', async ({ page }) => {
    await page.goto('/')

    await Promise.all([
      mockLLMValidation(page, { provider: 'openai', mockResponse: 'OpenAI response' }),
      mockLLMValidation(page, { provider: 'claude', mockResponse: 'Claude response' }),
      mockLLMValidation(page, { provider: 'deepseek', mockResponse: 'Deepseek response' }),
    ])

    const [openaiResp, claudeResp, deepseekResp] = await Promise.all([
      page.evaluate(async () => {
        return await fetch('/api/v2/integration/openai/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
        }).then(r => r.json())
      }),
      page.evaluate(async () => {
        return await fetch('/api/v2/integration/claude/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
        }).then(r => r.json())
      }),
      page.evaluate(async () => {
        return await fetch('/api/v2/integration/deepseek/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
        }).then(r => r.json())
      }),
    ])

    expect(openaiResp.choices[0].message.content).toBe('OpenAI response')
    expect(claudeResp.content[0].text).toBe('Claude response')
    expect(deepseekResp.choices[0].message.content).toBe('Deepseek response')
  })
})
