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
  isPrompt: boolean,
  overrides: Partial<Parameters<typeof NodeDetailPanel>[0]> = {},
): Parameters<typeof NodeDetailPanel>[0] {
  return {
    node,
    isPrompt,
    onUpdateNode: vi.fn(),
    onDelete: vi.fn(),
    onDuplicateNode: vi.fn(),
    onAddChild: vi.fn(),
    onAddSibling: vi.fn(),
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

function renderPanel(
  node: NodeData,
  isPrompt: boolean,
  overrides: Partial<Parameters<typeof NodeDetailPanel>[0]> = {},
) {
  const props = makeProps(node, isPrompt, overrides)
  const result = render(<NodeDetailPanel {...props} />, { wrapper })
  const rerenderPanel = (nextNode: NodeData, nextIsPrompt: boolean) =>
    result.rerender(
      <IntlProvider locale="en" messages={messages.en}>
        <NodeDetailPanel {...makeProps(nextNode, nextIsPrompt)} />
      </IntlProvider>,
    )
  return { ...result, rerenderPanel }
}

describe('NodeDetailPanel — collapsible sections initial state', () => {
  describe('Settings section', () => {
    it('is expanded for a non-prompt node', () => {
      renderPanel(makeNode({ command: '/chat test' }), false)
      expect(screen.getByTestId('settings-trigger')).toHaveAttribute('data-state', 'open')
    })

    it('is collapsed for a prompt node', () => {
      renderPanel(makeNode(), true)
      expect(screen.getByTestId('settings-trigger')).toHaveAttribute('data-state', 'closed')
    })
  })

  describe('Preview section', () => {
    it('is collapsed for a non-prompt node when the node has content', () => {
      renderPanel(makeNode({ command: '/chat test' }), false)
      expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'closed')
    })

    it('is expanded for a prompt node', () => {
      renderPanel(makeNode({ title: 'result text' }), true)
      expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'open')
    })

    it('is absent when the node has no title, no command, and is not a prompt', () => {
      renderPanel(makeNode({ title: undefined, command: undefined }), false)
      expect(screen.queryByTestId('preview-trigger')).not.toBeInTheDocument()
    })

    it('is present when isPrompt is true even with no title and no command', () => {
      renderPanel(makeNode({ title: undefined, command: undefined }), true)
      expect(screen.getByTestId('preview-trigger')).toBeInTheDocument()
    })

    it('is present when the node has a title but no command and is not a prompt', () => {
      renderPanel(makeNode({ title: 'some title', command: undefined }), false)
      expect(screen.getByTestId('preview-trigger')).toBeInTheDocument()
    })

    it('is present when the node has a command but no title and is not a prompt', () => {
      renderPanel(makeNode({ title: undefined, command: '/chat test' }), false)
      expect(screen.getByTestId('preview-trigger')).toBeInTheDocument()
    })
  })
})

describe('NodeDetailPanel — collapsible state response to isPrompt prop change', () => {
  it('collapses Settings when transitioning from non-prompt to prompt', () => {
    const node = makeNode({ title: 'text' })
    const { rerenderPanel } = renderPanel(node, false)
    expect(screen.getByTestId('settings-trigger')).toHaveAttribute('data-state', 'open')
    rerenderPanel(node, true)
    expect(screen.getByTestId('settings-trigger')).toHaveAttribute('data-state', 'closed')
  })

  it('expands Preview when transitioning from non-prompt to prompt', () => {
    const node = makeNode({ title: 'text' })
    const { rerenderPanel } = renderPanel(node, false)
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'closed')
    rerenderPanel(node, true)
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'open')
  })

  it('expands Settings when transitioning from prompt to non-prompt', () => {
    const node = makeNode({ title: 'text' })
    const { rerenderPanel } = renderPanel(node, true)
    expect(screen.getByTestId('settings-trigger')).toHaveAttribute('data-state', 'closed')
    rerenderPanel(node, false)
    expect(screen.getByTestId('settings-trigger')).toHaveAttribute('data-state', 'open')
  })

  it('collapses Preview when transitioning from prompt to non-prompt', () => {
    const node = makeNode({ title: 'text' })
    const { rerenderPanel } = renderPanel(node, true)
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'open')
    rerenderPanel(node, false)
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'closed')
  })
})

describe('NodeDetailPanel — collapsible user interaction', () => {
  it('Settings can be collapsed by clicking the trigger on a non-prompt node', () => {
    renderPanel(makeNode({ command: '/chat test' }), false)
    const trigger = screen.getByTestId('settings-trigger')
    expect(trigger).toHaveAttribute('data-state', 'open')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('data-state', 'closed')
  })

  it('Settings can be expanded by clicking the trigger on a prompt node', () => {
    renderPanel(makeNode({ title: 'text' }), true)
    const trigger = screen.getByTestId('settings-trigger')
    expect(trigger).toHaveAttribute('data-state', 'closed')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('data-state', 'open')
  })

  it('Preview can be expanded by clicking the trigger on a non-prompt node', () => {
    renderPanel(makeNode({ command: '/chat test' }), false)
    const trigger = screen.getByTestId('preview-trigger')
    expect(trigger).toHaveAttribute('data-state', 'closed')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('data-state', 'open')
  })

  it('Preview can be collapsed by clicking the trigger on a prompt node', () => {
    renderPanel(makeNode({ title: 'text' }), true)
    const trigger = screen.getByTestId('preview-trigger')
    expect(trigger).toHaveAttribute('data-state', 'open')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('data-state', 'closed')
  })

  it('Settings and Preview are toggled independently', () => {
    renderPanel(makeNode({ command: '/chat test' }), false)
    fireEvent.click(screen.getByTestId('preview-trigger'))
    expect(screen.getByTestId('settings-trigger')).toHaveAttribute('data-state', 'open')
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'open')
  })

  it('isPrompt transition resets user-overridden state — manually opened Preview collapses when isPrompt reverts to false', () => {
    const node = makeNode({ command: '/chat test' })
    const { rerenderPanel } = renderPanel(node, false)
    fireEvent.click(screen.getByTestId('preview-trigger'))
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'open')
    rerenderPanel(node, true)
    rerenderPanel(node, false)
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'closed')
  })
})

describe('NodeDetailPanel — preview content visibility', () => {
  it('preview content is in the DOM when the preview section is expanded', () => {
    renderPanel(makeNode({ title: 'text' }), true)
    expect(screen.getByTestId('node-preview-text')).toBeInTheDocument()
  })

  it('preview content is absent from the DOM when the preview section is collapsed', () => {
    renderPanel(makeNode({ command: '/chat test' }), false)
    expect(screen.queryByTestId('node-preview-text')).not.toBeInTheDocument()
  })
})

describe('NodeDetailPanel — settings content visibility', () => {
  it('execute button is in the DOM when settings is expanded', () => {
    renderPanel(makeNode({ command: '/chat test' }), false)
    expect(screen.getByTestId('execute-node-button')).toBeInTheDocument()
  })

  it('execute button is absent from the DOM when settings is collapsed', () => {
    renderPanel(makeNode({ title: 'text' }), true)
    expect(screen.queryByTestId('execute-node-button')).not.toBeInTheDocument()
  })
})

describe('NodeDetailPanel — preview auto-expand on execution complete', () => {
  it('expands preview when isExecuting transitions from true to false', () => {
    const node = makeNode({ command: '/chat test' })
    renderPanel(node, false, { isExecuting: false })
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'closed')
    expect(screen.queryByTestId('node-preview-text')).not.toBeInTheDocument()
  })

  it('preview starts collapsed when executing', () => {
    const node = makeNode({ command: '/chat test' })
    renderPanel(node, false, { isExecuting: true })
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'closed')
  })

  it('preview expands for prompt nodes regardless of execution state', () => {
    const node = makeNode({ title: 'result' })
    renderPanel(node, true, { isExecuting: false })
    expect(screen.getByTestId('preview-trigger')).toHaveAttribute('data-state', 'open')
  })
})

describe('NodeDetailPanel — Execute button behavior', () => {
  describe('queryType resolution for all command types', () => {
    it('resolves static command to mapped queryType', () => {
      const node = makeNode({ command: '/web search query' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, false, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'web')
    })

    it('resolves control-flow command to mapped queryType', () => {
      const node = makeNode({ command: '/foreach item in list' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, false, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'foreach')
    })

    it('resolves LLM provider command to mapped queryType', () => {
      const node = makeNode({ command: '/claude explain this' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, false, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'claude')
    })

    it('handles command without trailing text', () => {
      const node = makeNode({ command: '/web' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, false, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'web')
    })

    it('handles command with leading whitespace', () => {
      const node = makeNode({ command: '  /web search' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, false, { onExecute })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledWith(node, 'web')
    })
  })

  describe('button state management', () => {
    it('calls onExecute when enabled', () => {
      const node = makeNode({ command: '/chat test' })
      const onExecute = vi.fn().mockResolvedValue(true)
      renderPanel(node, false, { onExecute, executeDisabled: false })

      fireEvent.click(screen.getByTestId('execute-node-button'))

      expect(onExecute).toHaveBeenCalledTimes(1)
    })

    it('does not render when node is root', () => {
      const node = makeNode({ command: '/chat test', parent: null })
      renderPanel(node, true, {})

      expect(screen.queryByTestId('execute-node-button')).not.toBeInTheDocument()
    })
  })
})
