import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import type { ReactNode } from 'react'
import messages from '@shared/lib/intl'
import type { NodeData } from '@shared/base-types'
import { NodeDetailPanel } from '../node-detail-panel'
import { AliasProvider } from '@entities/aliases'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
})

vi.mock('@shared/lib/use-genie-state', () => ({
  useGenieState: () => 'idle',
}))

vi.mock('@features/workflow-tree/store', () => ({
  useWorkflowNodes: () => ({}),
  useWorkflowEdges: () => ({}),
}))

vi.mock('@features/workflow-tree/hooks/use-node-preview', () => ({
  useNodePreview: () => ({ previewText: '' }),
}))
vi.mock('@entities/auth', () => ({
  useAuthContext: () => ({ isLoggedIn: false }),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <IntlProvider locale="en" messages={messages.en}>
      <AliasProvider>{children}</AliasProvider>
    </IntlProvider>
  </QueryClientProvider>
)

function makeNode(overrides: Partial<NodeData> = {}): NodeData {
  return { id: 'n1', title: 'Test Node', children: [], ...overrides }
}

function makeProps(
  node: NodeData,
  overrides: Partial<Parameters<typeof NodeDetailPanel>[0]> = {},
): Parameters<typeof NodeDetailPanel>[0] {
  return {
    node,
    onUpdateNode: vi.fn(),
    onEnterInCommand: vi.fn(),
    onCtrlEnterInCommand: vi.fn(),
    onShiftCtrlEnterInCommand: vi.fn(),
    onClose: vi.fn(),
    onExecute: vi.fn(),
    onAbort: vi.fn(),
    isExecuting: false,
    executeDisabled: false,
    ...overrides,
  }
}

function renderPanel(node: NodeData, overrides: Partial<Parameters<typeof NodeDetailPanel>[0]> = {}) {
  const props = makeProps(node, overrides)
  const result = render(<NodeDetailPanel {...props} />, { wrapper })
  const rerenderPanel = (nextNode: NodeData) =>
    result.rerender(
      <IntlProvider locale="en" messages={messages.en}>
        <NodeDetailPanel {...makeProps(nextNode, overrides)} />
      </IntlProvider>,
    )
  return { ...result, rerenderPanel }
}

describe('NodeDetailPanel — chat layout', () => {
  it('shows auto badge when the title is derived from the command', () => {
    renderPanel(makeNode({ command: '/chat hi', title: '/chat hi' }))
    expect(screen.getByText('auto')).toBeInTheDocument()
  })

  it('hides auto badge for a user-authored title', () => {
    renderPanel(makeNode({ command: '/chat hi', title: 'My own title' }))
    expect(screen.queryByText('auto')).not.toBeInTheDocument()
  })

  it('renders the OUTPUT section with a grounded status line', () => {
    renderPanel(makeNode({ command: '/chat hi' }))
    expect(screen.getByTestId('output-section')).toBeInTheDocument()
    expect(screen.getByTestId('output-status-line')).toHaveTextContent('idle · /chat')
  })

  it('renders a role chip when the command is slash-prefixed', () => {
    renderPanel(makeNode({ command: '/chat hi' }))
    expect(screen.getByTestId('command-role-chip')).toHaveTextContent('/chat')
  })

  it('omits the role chip when the draft is not slash-prefixed', () => {
    renderPanel(makeNode({ command: 'plain text' }))
    expect(screen.queryByTestId('command-role-chip')).not.toBeInTheDocument()
  })

  it('shows the command character count in the composer footer', () => {
    renderPanel(makeNode({ command: '/chat' }))
    expect(screen.getByText(/chars · ⏎ run/)).toBeInTheDocument()
  })

  it('rename button starts title editing', () => {
    renderPanel(makeNode())
    expect(screen.queryByDisplayValue('Test Node')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rename-node-button'))
    expect(screen.getByDisplayValue('Test Node')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — Execute button behavior', () => {
  describe('queryType resolution for all command types', () => {
    it('resolves static command to mapped queryType', () => {
      const node = makeNode({ command: '/web search query' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'web')
    })

    it('resolves control-flow command to mapped queryType', () => {
      const node = makeNode({ command: '/foreach item in list' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'foreach')
    })

    it('resolves LLM provider command to mapped queryType', () => {
      const node = makeNode({ command: '/claude explain this' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'claude')
    })

    it('handles command without trailing text', () => {
      const node = makeNode({ command: '/web' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'web')
    })

    it('handles command with leading whitespace', () => {
      const node = makeNode({ command: '  /web search' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'web')
    })
  })

  describe('button state management', () => {
    it('calls onExecute when enabled', () => {
      const node = makeNode({ command: '/chat test' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute, executeDisabled: false })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledTimes(1)
    })

    it('disables a non-slash command and shows validation feedback', () => {
      const node = makeNode({ command: 'not a slash command' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute, executeDisabled: false })

      expect(screen.getByTestId('execute-node-button')).toBeDisabled()
      expect(screen.getByTestId('command-validation-message')).toHaveTextContent('Enter a valid slash command')

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).not.toHaveBeenCalled()
    })

    it('enables an unregistered slash command so the backend can report the unknown-alias error', () => {
      const node = makeNode({ command: '/unregistered-alias task' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute, executeDisabled: false })

      expect(screen.getByTestId('execute-node-button')).toBeEnabled()
      expect(screen.queryByTestId('command-validation-message')).not.toBeInTheDocument()
    })

    it('validates the current command draft instead of the previous committed value', () => {
      const node = makeNode({ command: '' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, { onExecute, executeDisabled: false })
      const commandField = screen.getByPlaceholderText(/command/i)
      const executeButton = screen.getByTestId('execute-node-button')

      expect(executeButton).toBeDisabled()

      fireEvent.change(commandField, { target: { value: '/chat ok' } })
      expect(executeButton).toBeEnabled()

      fireEvent.change(commandField, { target: { value: 'not a command' } })
      expect(executeButton).toBeDisabled()

      fireEvent.change(commandField, { target: { value: '/chat ok again' } })
      expect(executeButton).toBeEnabled()

      fireEvent.click(executeButton)

      expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ command: '/chat ok again' }), 'chat')
    })

    it('empty command draft is disabled without showing a validation message', () => {
      const node = makeNode({ command: '' })
      renderPanel(node, { executeDisabled: false })

      expect(screen.getByTestId('execute-node-button')).toBeDisabled()
      expect(screen.queryByTestId('command-validation-message')).not.toBeInTheDocument()
    })

    it('executeDisabled prop disables the button even when the draft is a valid command', () => {
      const node = makeNode({ command: '/chat ok' })
      renderPanel(node, { executeDisabled: true })

      expect(screen.getByTestId('execute-node-button')).toBeDisabled()
    })

    it('switching to a different node resets draft validation to the incoming node command', () => {
      const nodeA = makeNode({ id: 'a', command: '/chat valid' })
      const nodeB = makeNode({ id: 'b', command: '' })
      const onExecute = vi.fn().mockResolvedValue(true)

      const { rerender } = renderPanel(nodeA, { onExecute, executeDisabled: false })
      expect(screen.getByTestId('execute-node-button')).toBeEnabled()

      rerender(<NodeDetailPanel {...makeProps(nodeB, { onExecute, executeDisabled: false })} />)

      expect(screen.getByTestId('execute-node-button')).toBeDisabled()
      expect(screen.queryByTestId('command-validation-message')).not.toBeInTheDocument()
    })
  })
})

describe('NodeDetailPanel — handleCommandChange title sync', () => {
  // exhaustive suffix-pattern coverage for all variant types is in reliability-suffix.test.ts
  const COMMAND_DERIVED_CASES = [
    ['title exactly equals command', '/chat list colors', '/chat list colors'],
    ['title is command plus bestOfN suffix', '/chat :n=2 list colors', '/chat :n=2 list colors [✓ 2/2 best of 2]'],
    ['title is command plus refined suffix', '/chat list', '/chat list [✓ refined]'],
  ] as const

  it.each(COMMAND_DERIVED_CASES)('syncs both command and title to new command when %s', (_label, command, title) => {
    const node = makeNode({ command, title })
    const onUpdateNode = vi.fn()
    renderPanel(node, { onUpdateNode })

    const textarea = screen.getByPlaceholderText(/command/i)
    fireEvent.change(textarea, { target: { value: '/chat list fruits' } })
    fireEvent.blur(textarea)

    expect(onUpdateNode).toHaveBeenCalledWith('n1', {
      command: '/chat list fruits',
      title: '/chat list fruits',
    })
  })

  it('syncs title to new command when node has no title', () => {
    const node = makeNode({ command: '/chat list colors', title: undefined })
    const onUpdateNode = vi.fn()
    renderPanel(node, { onUpdateNode })

    const textarea = screen.getByPlaceholderText(/command/i)
    fireEvent.change(textarea, { target: { value: '/chat list fruits' } })
    fireEvent.blur(textarea)

    expect(onUpdateNode).toHaveBeenCalledWith('n1', {
      command: '/chat list fruits',
      title: '/chat list fruits',
    })
  })

  const USER_AUTHORED_CASES = [
    ['user-authored title with a reliability suffix', '/chat analyse', 'My competitor analysis [✓ 2/2 best of 2]'],
    ['user-authored title without any suffix', '/chat analyse', 'My competitor analysis'],
  ] as const

  it.each(USER_AUTHORED_CASES)('updates only command when node has %s', (_label, command, title) => {
    const node = makeNode({ command, title })
    const onUpdateNode = vi.fn()
    renderPanel(node, { onUpdateNode })

    const textarea = screen.getByPlaceholderText(/command/i)
    fireEvent.change(textarea, { target: { value: '/chat list fruits' } })
    fireEvent.blur(textarea)

    expect(onUpdateNode).toHaveBeenCalledWith('n1', { command: '/chat list fruits' })
  })
})

describe('NodeDetailPanel — autoFocusTitle prop', () => {
  it('title field is in read-only mode when autoFocusTitle is false', () => {
    renderPanel(makeNode(), { autoFocusTitle: false })

    expect(screen.queryByDisplayValue('Test Node')).not.toBeInTheDocument()
  })

  it('title field enters edit mode when autoFocusTitle is true', () => {
    renderPanel(makeNode(), { autoFocusTitle: true })

    expect(screen.getByDisplayValue('Test Node')).toBeInTheDocument()
  })

  it('title field enters edit mode when autoFocusTitle transitions from false to true', () => {
    const node = makeNode()
    const { rerender } = renderPanel(node, { autoFocusTitle: false })
    expect(screen.queryByDisplayValue('Test Node')).not.toBeInTheDocument()

    rerender(<NodeDetailPanel {...makeProps(node, { autoFocusTitle: true })} />)

    expect(screen.getByDisplayValue('Test Node')).toBeInTheDocument()
  })

  it('title field returns to read-only after user cancels the auto-focused edit', () => {
    renderPanel(makeNode(), { autoFocusTitle: true })
    const textarea = screen.getByDisplayValue('Test Node')
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(screen.queryByDisplayValue('Test Node')).not.toBeInTheDocument()
    expect(screen.getByText('Test Node')).toBeInTheDocument()
  })
})
