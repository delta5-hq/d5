import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { CustomLLMApiType } from '@shared/config'
import { CustomLLMDialog } from './custom-llm-dialog'

const mockSave = vi.fn()

vi.mock('@shared/composables', () => ({
  useApiMutation: () => ({ mutateAsync: mockSave }),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const messages = {
  'integration.custom_llm.title': 'Custom LLM',
  'dialog.integration.saveSuccess': 'Saved',
  'dialog.integration.authenticationError': 'Authentication failed',
  'dialog.integration.rateLimitExceeded': 'Rate limit exceeded',
  'dialog.integration.noAccess': 'No access',
  'dialog.integration.serverError': 'Server error',
  'dialog.integration.wrongRequest': 'Wrong request',
  'dialog.integration.apiKey': 'API Key',
  'dialog.integration.model': 'Model',
  customLLMHint: 'Configure custom LLM',
  apiType: 'API Type',
  apiRootUrl: 'API Root URL',
  maxTokens: 'Max tokens',
  embeddingsChunkSize: 'Embeddings chunk size',
  save: 'Save',
  cancel: 'Cancel',
}

const renderDialog = () =>
  render(
    <IntlProvider locale="en" messages={messages}>
      <CustomLLMDialog data={undefined} open refresh={vi.fn()} />
    </IntlProvider>,
  )

const savedCustomLLM = {
  apiType: 'OpenAI compatible',
  apiKey: 'sk-saved',
  model: 'old-model',
  apiRootUrl: 'https://custom.example.test/v1',
  maxTokens: 30000,
  embeddingsChunkSize: 2048,
}

const renderCustomLLMDialog = (data = savedCustomLLM) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      <CustomLLMDialog data={data} open refresh={vi.fn()} />
    </IntlProvider>,
  )

const submitEndpoint = async () => {
  renderDialog()
  fireEvent.change(screen.getByLabelText('API Root URL'), { target: { value: 'https://bad.example.test/v1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  return screen.findByRole('alert')
}

const submitSavedDialogChange = async (label: string, value: string) => {
  renderCustomLLMDialog()
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  return screen.findByRole('alert')
}

beforeEach(() => {
  vi.clearAllMocks()
  window.fetch = vi.fn()
})

describe('CustomLLMDialog endpoint validation', () => {
  it('renders every configured Custom LLM API type as a selectable option', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('combobox'))

    Object.values(CustomLLMApiType).forEach(apiType => expect(screen.getAllByText(apiType).length).toBeGreaterThan(0))
  })
  it.each([
    ['current display value', 'OpenAI compatible'],
    ['legacy OpenAI key', 'openai'],
    ['legacy snake-case OpenAI key', 'openai_compatible'],
    ['legacy camel-case OpenAI key', 'openaiCompatible'],
    ['legacy reasoning key', 'openai_compatible_chain_of_thought', 'OpenAI compatible Chain-of-Thought'],
    ['unknown stored key', 'future_unknown_type'],
  ])('normalizes %s into a supported visible select value', (_caseName, apiType, expected = 'OpenAI compatible') => {
    renderCustomLLMDialog({ ...savedCustomLLM, apiType })

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it.each([
    ['HTTP 500 body', () => Promise.resolve(new Response('connection refused', { status: 500 })), 'connection refused'],
    [
      'HTTP 404 body',
      () => Promise.resolve(new Response('model route not found', { status: 404 })),
      'model route not found',
    ],
    [
      'empty HTTP error body',
      () => Promise.resolve(new Response('', { status: 502, statusText: 'Bad Gateway' })),
      'Validation failed: 502',
    ],
    ['network failure', () => Promise.reject(new TypeError('fetch failed')), 'Custom LLM endpoint is unreachable.'],
  ])('surfaces %s inline and does not persist invalid settings', async (_label, responseFactory, expectedError) => {
    vi.mocked(window.fetch).mockImplementation(responseFactory)

    const alert = await submitEndpoint()

    await waitFor(() => expect(alert).toHaveTextContent(expectedError))
    expect(mockSave).not.toHaveBeenCalled()
  })

  it.each([
    ['Model', 'new-model'],
    ['Max tokens', '1234'],
    ['Embeddings chunk size', '512'],
  ])('validates the effective endpoint when only %s changes', async (label, value) => {
    vi.mocked(window.fetch).mockResolvedValue(new Response(`${label} rejected`, { status: 400 }))

    const alert = await submitSavedDialogChange(label, value)

    await waitFor(() => expect(alert).toHaveTextContent(`${label} rejected`))
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('shows the saved model when editing existing Custom LLM settings', () => {
    renderCustomLLMDialog({ ...savedCustomLLM, model: 'test-model' })

    expect(screen.getByLabelText('Model')).toHaveValue('test-model')
  })
})
