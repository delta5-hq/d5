import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import MCPDialog from './mcp-dialog'

const mockSave = vi.fn()
const mockRefresh = vi.fn()

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
  'integration.mcp.add': 'Add MCP Server',
  'integration.mcp.edit': 'Edit MCP Server',
  'dialog.integration.saveSuccess': 'Saved',
  'dialog.integration.alias': 'Alias',
  'dialog.integration.transport': 'Transport',
  'dialog.integration.description': 'Description',
  'dialog.integration.toolName': 'Tool Name',
  'dialog.integration.toolInputField': 'Tool Input Field',
  'dialog.integration.command': 'Command',
  'dialog.integration.arguments': 'Arguments',
  'dialog.integration.environmentVariables': 'Environment Variables',
  'dialog.integration.serverUrl': 'Server URL',
  'dialog.integration.headers': 'Headers',
  'dialog.integration.timeout': 'Timeout',
  'dialog.integration.presets': 'Presets',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
}

const renderDialog = (props: Partial<React.ComponentProps<typeof MCPDialog>> = {}) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      <MCPDialog open refresh={mockRefresh} {...props} />
    </IntlProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MCPDialog config and secret fields', () => {
  const saveDialog = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mockSave).toHaveBeenCalled())
    return mockSave.mock.calls[0][0]
  }

  it('serializes stdio environment variables with MCP config in one save payload', async () => {
    renderDialog()

    fireEvent.change(screen.getByLabelText(/Alias/), { target: { value: '/secure-mcp' } })
    fireEvent.change(screen.getByLabelText(/Tool Name/), { target: { value: 'secure_tool' } })
    fireEvent.change(screen.getByLabelText(/Command/), { target: { value: 'node' } })
    fireEvent.change(screen.getByLabelText(/Environment Variables/), {
      target: { value: 'API_KEY=secret\nNODE_ENV=production' },
    })
    await expect(saveDialog()).resolves.toEqual(
      expect.objectContaining({
        env: { API_KEY: 'secret', NODE_ENV: 'production' },
      }),
    )
  })

  it('round-trips stdio environment variables with MCP config in the edit dialog', async () => {
    renderDialog({
      isEdit: true,
      data: {
        alias: '/stdio-mcp',
        transport: 'stdio',
        toolName: 'stdio_tool',
        toolInputField: 'prompt',
        command: 'node',
        env: { API_KEY: 'secret', NODE_ENV: 'production' },
      },
    })

    expect(screen.getByLabelText(/Environment Variables/)).toHaveValue('API_KEY=secret\nNODE_ENV=production')

    await expect(saveDialog()).resolves.toEqual(
      expect.objectContaining({
        alias: '/stdio-mcp',
        transport: 'stdio',
        env: { API_KEY: 'secret', NODE_ENV: 'production' },
      }),
    )
  })

  it.each(['streamable-http', 'sse'] as const)(
    'round-trips %s headers with MCP config in the edit dialog',
    async transport => {
      renderDialog({
        isEdit: true,
        data: {
          alias: '/remote-mcp',
          transport,
          toolName: 'remote_tool',
          toolInputField: 'prompt',
          serverUrl: 'https://mcp.example.test',
          headers: { Authorization: 'Bearer token', 'X-API-Key': 'secret' },
        },
      })

      expect(screen.getByLabelText(/Headers/)).toHaveValue('Authorization=Bearer token\nX-API-Key=secret')

      await expect(saveDialog()).resolves.toEqual(
        expect.objectContaining({
          alias: '/remote-mcp',
          transport,
          headers: { Authorization: 'Bearer token', 'X-API-Key': 'secret' },
        }),
      )
    },
  )

  it('keeps empty optional secret maps harmless when saving each transport', async () => {
    renderDialog({
      isEdit: true,
      data: {
        alias: '/remote-mcp',
        transport: 'streamable-http',
        toolName: 'remote_tool',
        toolInputField: 'prompt',
        serverUrl: 'https://mcp.example.test',
      },
    })

    await expect(saveDialog()).resolves.toEqual(
      expect.objectContaining({
        headers: {},
      }),
    )
  })
})
