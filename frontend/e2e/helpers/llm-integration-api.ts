import type { Page } from '@playwright/test'

export async function saveLLMProviderSettings(
  page: Page,
  provider: string,
  settings: Record<string, string>,
): Promise<void> {
  const response = await page.request.put(`/api/v2/integration/${provider}/update`, {
    data: settings,
  })
  if (!response.ok()) {
    throw new Error(`Failed to save ${provider} settings: HTTP ${response.status()} ${await response.text()}`)
  }
}

export async function clearLLMProviderSettings(page: Page, provider: string): Promise<void> {
  await saveLLMProviderSettings(page, provider, { apiKey: '', model: '' })
}
