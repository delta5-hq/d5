import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlProvider } from 'react-intl'

import * as baseApi from '@shared/lib/base-api'
import ArrayIntegrationSection from './array-integration-section'

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('./delete-confirmation-dialog', () => ({
  DeleteConfirmationDialog: ({
    open,
    alias,
    onConfirm,
    onCancel,
  }: {
    open: boolean
    alias: string
    onConfirm: () => void
    onCancel: () => void
  }) =>
    open ? (
      <div data-testid="delete-dialog">
        <span data-testid="delete-alias">{alias}</span>
        <button data-testid="confirm-delete" onClick={onConfirm} type="button">
          Confirm
        </button>
        <button data-testid="cancel-delete" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    ) : null,
}))

const messages: Record<string, string> = {
  'integration.mcp.title': 'MCP Servers',
  'integration.rpc.title': 'RPC Integrations',
  'integration.mcp.add': 'Add MCP',
  'integration.rpc.add': 'Add RPC',
  'integration.inheritedNote': 'Inherited from global settings',
  'integration.session.active': 'Session active',
  'dialog.integration.deleteAction': 'Delete',
  'dialog.integration.deleteSuccess': 'Deleted successfully',
  'integrationSettings.none': 'No integrations configured',
  errorServer: 'Server error',
}

const renderWithIntl = (ui: React.ReactElement) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      {ui}
    </IntlProvider>,
  )

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  alias: '/test-alias',
  ...overrides,
})

const apiFetchMock = vi.mocked(baseApi.apiFetch)

describe('ArrayIntegrationSection — empty state', () => {
  it('renders empty state component when items is empty and not inherited', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('No integrations configured')).toBeInTheDocument()
  })

  it('renders nothing when items is empty and inherited', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        inherited
        items={[]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})

describe('ArrayIntegrationSection — card rendering', () => {
  it('renders one card per item', () => {
    const items = [makeItem({ alias: '/alpha' }), makeItem({ alias: '/beta' }), makeItem({ alias: '/gamma' })]
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={items}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('/alpha')).toBeInTheDocument()
    expect(screen.getByText('/beta')).toBeInTheDocument()
    expect(screen.getByText('/gamma')).toBeInTheDocument()
  })

  it('renders section title from titleId', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem()]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('MCP Servers')).toBeInTheDocument()
  })

  it('renders add button when not inherited and items present', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem()]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByRole('button', { name: /add mcp/i })).toBeInTheDocument()
  })

  it('does not render add button when inherited', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        inherited
        items={[makeItem()]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.queryByRole('button', { name: /add/i })).not.toBeInTheDocument()
  })
})

describe('ArrayIntegrationSection — integration type badge', () => {
  it('renders transport badge when item has transport field', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/mcp-tool', transport: 'stdio' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('STDIO')).toBeInTheDocument()
  })

  it('renders protocol badge when item has protocol field', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="rpc"
        items={[makeItem({ alias: '/rpc-tool', protocol: 'ssh' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.rpc.title"
      />,
    )
    expect(screen.getByText('SSH')).toBeInTheDocument()
  })

  it('prefers transport over protocol when both present', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/tool', transport: 'stdio', protocol: 'http' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('STDIO')).toBeInTheDocument()
    expect(screen.queryByText('HTTP')).not.toBeInTheDocument()
  })

  it('renders no badge when item has neither transport nor protocol', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/no-type' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.queryByText('STDIO')).not.toBeInTheDocument()
    expect(screen.queryByText('SSH')).not.toBeInTheDocument()
    expect(screen.queryByText('HTTP')).not.toBeInTheDocument()
  })

  it('renders all transport variants correctly', () => {
    const transports: Array<{ transport: string; label: string }> = [
      { transport: 'stdio', label: 'STDIO' },
      { transport: 'streamable-http', label: 'HTTP' },
    ]
    for (const { transport, label } of transports) {
      const { unmount } = renderWithIntl(
        <ArrayIntegrationSection
          fieldName="mcp"
          items={[makeItem({ alias: `/t-${transport}`, transport })]}
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          refresh={vi.fn()}
          titleId="integration.mcp.title"
        />,
      )
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('renders all protocol variants correctly', () => {
    const protocols: Array<{ protocol: string; label: string }> = [
      { protocol: 'ssh', label: 'SSH' },
      { protocol: 'http', label: 'HTTP' },
      { protocol: 'acp-local', label: 'ACP' },
    ]
    for (const { protocol, label } of protocols) {
      const { unmount } = renderWithIntl(
        <ArrayIntegrationSection
          fieldName="rpc"
          items={[makeItem({ alias: `/p-${protocol}`, protocol })]}
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          refresh={vi.fn()}
          titleId="integration.rpc.title"
        />,
      )
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })
})

describe('ArrayIntegrationSection — key config detail', () => {
  it('shows toolName with Tool: prefix when present', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/t', toolName: 'my_tool' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('Tool: my_tool')).toBeInTheDocument()
  })

  it('shows commandTemplate when toolName absent', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="rpc"
        items={[makeItem({ alias: '/t', commandTemplate: 'claude -p "{{prompt}}"' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.rpc.title"
      />,
    )
    expect(screen.getByText('claude -p "{{prompt}}"')).toBeInTheDocument()
  })

  it('shows command when toolName and commandTemplate absent', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="rpc"
        items={[makeItem({ alias: '/t', command: 'node' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.rpc.title"
      />,
    )
    expect(screen.getByText('node')).toBeInTheDocument()
  })

  it('toolName takes priority over commandTemplate and command', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/t', toolName: 'priority_tool', commandTemplate: 'template', command: 'cmd' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('Tool: priority_tool')).toBeInTheDocument()
    expect(screen.queryByText('template')).not.toBeInTheDocument()
    expect(screen.queryByText('cmd')).not.toBeInTheDocument()
  })

  it('commandTemplate takes priority over command when toolName absent', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="rpc"
        items={[makeItem({ alias: '/t', commandTemplate: 'my-template', command: 'my-cmd' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.rpc.title"
      />,
    )
    expect(screen.getByText('my-template')).toBeInTheDocument()
    expect(screen.queryByText('my-cmd')).not.toBeInTheDocument()
  })

  it('renders no detail paragraph when all three fields absent', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/t' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(container.querySelectorAll('p.truncate')).toHaveLength(0)
  })

  it('shows item description when present', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/t', description: 'My custom integration' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('My custom integration')).toBeInTheDocument()
  })

  it('does not render description element when description absent', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/t' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(container.querySelectorAll('p.line-clamp-2')).toHaveLength(0)
  })
})

describe('ArrayIntegrationSection — inherited mode', () => {
  it('shows inherited note when inherited=true', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        inherited
        items={[makeItem()]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('Inherited from global settings')).toBeInTheDocument()
  })

  it('does not show inherited note when inherited=false', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem()]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.queryByText('Inherited from global settings')).not.toBeInTheDocument()
  })

  it('does not render delete button when inherited=true', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        inherited
        items={[makeItem({ alias: '/no-delete' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.queryByRole('button', { name: /^Delete /i })).not.toBeInTheDocument()
  })

  it('renders delete button when not inherited', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/has-delete' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByRole('button', { name: /^Delete /i })).toBeInTheDocument()
  })
})

describe('ArrayIntegrationSection — interaction callbacks', () => {
  it('calls onEdit with the item when card is clicked', () => {
    const onEdit = vi.fn()
    const item = makeItem({ alias: '/click-me', transport: 'stdio' })
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[item]}
        onAdd={vi.fn()}
        onEdit={onEdit}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit \/click-me/i }))
    expect(onEdit).toHaveBeenCalledWith(item)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('calls onEdit when Enter key pressed on card', () => {
    const onEdit = vi.fn()
    const item = makeItem({ alias: '/key-enter' })
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[item]}
        onAdd={vi.fn()}
        onEdit={onEdit}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: /edit \/key-enter/i }), { key: 'Enter' })
    expect(onEdit).toHaveBeenCalledWith(item)
  })

  it('calls onEdit when Space key pressed on card', () => {
    const onEdit = vi.fn()
    const item = makeItem({ alias: '/key-space' })
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[item]}
        onAdd={vi.fn()}
        onEdit={onEdit}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: /edit \/key-space/i }), { key: ' ' })
    expect(onEdit).toHaveBeenCalledWith(item)
  })

  it('does not call onEdit for unhandled keys', () => {
    const onEdit = vi.fn()
    const item = makeItem({ alias: '/key-tab' })
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[item]}
        onAdd={vi.fn()}
        onEdit={onEdit}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: /edit \/key-tab/i }), { key: 'Tab' })
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('calls onAdd when add button is clicked', () => {
    const onAdd = vi.fn()
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem()]}
        onAdd={onAdd}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add mcp/i }))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('each card is independently clickable with correct item', () => {
    const onEdit = vi.fn()
    const itemA = makeItem({ alias: '/alpha' })
    const itemB = makeItem({ alias: '/beta' })
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[itemA, itemB]}
        onAdd={vi.fn()}
        onEdit={onEdit}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /edit \/beta/i }))
    expect(onEdit).toHaveBeenCalledWith(itemB)
    expect(onEdit).not.toHaveBeenCalledWith(itemA)
  })
})

describe('ArrayIntegrationSection — delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows delete dialog when delete button clicked', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/to-delete' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete \/to-delete/i }))
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('delete-alias')).toHaveTextContent('/to-delete')
  })

  it('dismisses dialog without API call when cancel clicked', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/to-delete' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete \/to-delete/i }))
    fireEvent.click(screen.getByTestId('cancel-delete'))
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('calls apiFetch DELETE and refresh on confirm', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined)
    const refresh = vi.fn().mockResolvedValue(undefined)

    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/to-delete' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={refresh}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete \/to-delete/i }))
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/integration/mcp/items/'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('dismisses dialog after successful delete', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined)
    const refresh = vi.fn().mockResolvedValue(undefined)

    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/gone' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={refresh}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete \/gone/i }))
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument())
  })

  it('encodes alias in delete URL', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined)
    const refresh = vi.fn().mockResolvedValue(undefined)

    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/my alias' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={refresh}
        titleId="integration.mcp.title"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete \/my alias/i }))
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    const [url] = apiFetchMock.mock.calls[0] as [string, unknown]
    expect(url).toContain(encodeURIComponent('/my alias'))
  })

  it('appends workflowId to delete URL when provided', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined)
    const refresh = vi.fn().mockResolvedValue(undefined)

    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/wf-alias' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={refresh}
        titleId="integration.mcp.title"
        workflowId="workflow-123"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete \/wf-alias/i }))
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    const [url] = apiFetchMock.mock.calls[0] as [string, unknown]
    expect(url).toContain('workflowId=workflow-123')
  })

  it('does not append workflowId to delete URL when workflowId is null', async () => {
    apiFetchMock.mockResolvedValueOnce(undefined)
    const refresh = vi.fn().mockResolvedValue(undefined)

    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/no-wf' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={refresh}
        titleId="integration.mcp.title"
        workflowId={null}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete \/no-wf/i }))
    fireEvent.click(screen.getByTestId('confirm-delete'))

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled())
    const [url] = apiFetchMock.mock.calls[0] as [string, unknown]
    expect(url).not.toContain('workflowId')
  })
})

describe('ArrayIntegrationSection — layout contract', () => {
  it('card grid container uses flex layout with 16px gap', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/layout-test' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(container.querySelector('.flex.flex-wrap.gap-4')).toBeInTheDocument()
  })

  it('individual cards do not carry per-card margin spacing', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/no-margin' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const cards = container.querySelectorAll('[data-alias]')
    for (const card of cards) {
      expect(card.className).not.toMatch(/\bm-1\b/)
    }
  })

  it('alias text element has min-w-0 to enable wrapping in flex row', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/long-alias-that-might-overflow' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const aliasEl = screen.getByText('/long-alias-that-might-overflow')
    expect(aliasEl.className).toMatch(/\bmin-w-0\b/)
  })

  it('alias flex row container has min-w-0 to prevent flex overflow expansion', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/overflow-test' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const aliasEl = screen.getByText('/overflow-test')
    expect(aliasEl.parentElement?.className).toMatch(/\bmin-w-0\b/)
  })

  it('all cards carry min-h-40 to enforce minimum height parity across integration tile types', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[
          makeItem({ alias: '/short' }),
          makeItem({ alias: '/with-description', description: 'A longer description text' }),
          makeItem({ alias: '/with-type', transport: 'stdio' }),
        ]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const cards = container.querySelectorAll('[data-alias]')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.className).toMatch(/\bmin-h-40\b/)
    }
  })

  it('inherited cards carry min-h-40 consistent with non-inherited cards', () => {
    const { container } = renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        inherited
        items={[makeItem({ alias: '/inherited-item' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const cards = container.querySelectorAll('[data-alias]')
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      expect(card.className).toMatch(/\bmin-h-40\b/)
    }
  })

  it('alias text element has title attribute equal to alias for full-text tooltip on overflow', () => {
    const longAlias = '/very-long-alias-that-will-definitely-overflow-the-card-width'
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: longAlias })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const aliasEl = screen.getByText(longAlias)
    expect(aliasEl).toHaveAttribute('title', longAlias)
  })

  it('title attribute on alias matches the exact alias value, not a truncated or modified form', () => {
    const aliases = ['/a', '/short-alias', '/alias-with-special-chars_123']
    for (const alias of aliases) {
      const { unmount } = renderWithIntl(
        <ArrayIntegrationSection
          fieldName="mcp"
          items={[makeItem({ alias })]}
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          refresh={vi.fn()}
          titleId="integration.mcp.title"
        />,
      )
      const aliasEl = screen.getByText(alias)
      expect(aliasEl).toHaveAttribute('title', alias)
      unmount()
    }
  })

  it('alias text element uses truncate class for single-line overflow handling', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/truncate-test' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const aliasEl = screen.getByText('/truncate-test')
    expect(aliasEl.className).toMatch(/\btruncate\b/)
  })

  it('integration type badge is rendered in a separate block below alias, not alongside it in a flex row', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/badge-layout', transport: 'stdio' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const aliasEl = screen.getByText('/badge-layout')
    const aliasContainer = aliasEl.parentElement!
    const allChildren = Array.from(aliasContainer.children)
    const aliasIndex = allChildren.indexOf(aliasEl)
    expect(aliasIndex).toBeGreaterThanOrEqual(0)
    expect(aliasEl.querySelector('[class*="badge"], [data-slot="badge"]')).toBeNull()
    const siblingsAfterAlias = allChildren.slice(aliasIndex + 1)
    expect(siblingsAfterAlias.length).toBeGreaterThan(0)
  })

  it('alias element does not use break-all — truncation replaces line-wrapping for overflow', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/overflow-class-test' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const aliasEl = screen.getByText('/overflow-class-test')
    expect(aliasEl.className).not.toMatch(/\bbreak-all\b/)
  })
})

describe('ArrayIntegrationSection — session indicator', () => {
  it('renders session indicator when lastSessionId is present', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/svc', lastSessionId: 'abc123def456' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('Session active')).toBeInTheDocument()
  })

  it('renders last 8 characters of sessionId as monospace suffix', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/svc', lastSessionId: 'xxxx0000aabbccdd' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getByText('…aabbccdd')).toBeInTheDocument()
  })

  it('exposes full sessionId as title tooltip for long IDs', () => {
    const sessionId = 'full-session-id-for-tooltip'
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/svc', lastSessionId: sessionId })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    const indicator = screen.getByText('Session active').closest('p')
    expect(indicator).toHaveAttribute('title', sessionId)
  })

  it('does not render session indicator when lastSessionId is null', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/svc', lastSessionId: null })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.queryByText('Session active')).not.toBeInTheDocument()
  })

  it('does not render session indicator when lastSessionId is absent', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[makeItem({ alias: '/svc' })]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.queryByText('Session active')).not.toBeInTheDocument()
  })

  it('renders session indicator for each item that has a sessionId', () => {
    renderWithIntl(
      <ArrayIntegrationSection
        fieldName="mcp"
        items={[
          makeItem({ alias: '/with-session', lastSessionId: 'sess-aaaa' }),
          makeItem({ alias: '/no-session' }),
          makeItem({ alias: '/also-with-session', lastSessionId: 'sess-bbbb' }),
        ]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        refresh={vi.fn()}
        titleId="integration.mcp.title"
      />,
    )
    expect(screen.getAllByText('Session active')).toHaveLength(2)
  })
})
