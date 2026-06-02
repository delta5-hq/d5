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
    renderPanel(node, false, { onUpdateNode })

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
    renderPanel(node, false, { onUpdateNode })

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
    renderPanel(node, false, { onUpdateNode })

    const textarea = screen.getByPlaceholderText(/command/i)
    fireEvent.change(textarea, { target: { value: '/chat list fruits' } })
    fireEvent.blur(textarea)

    expect(onUpdateNode).toHaveBeenCalledWith('n1', { command: '/chat list fruits' })
  })
})

describe('NodeDetailPanel — refineCost hint', () => {
  it('shows the cost hint when refineCost is a positive number', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 4 })
    expect(screen.getByTestId('refine-cost-hint')).toBeInTheDocument()
  })

  it('hides the cost hint when refineCost is null', () => {
    renderPanel(makeNode({ command: '/chat query' }), false, { refineCost: null })
    expect(screen.queryByTestId('refine-cost-hint')).not.toBeInTheDocument()
  })

  it('hides the cost hint when refineCost prop is omitted', () => {
    renderPanel(makeNode({ command: '/chat query' }), false)
    expect(screen.queryByTestId('refine-cost-hint')).not.toBeInTheDocument()
  })

  it('shows the cost hint when refineCost is 0 (boundary: only null is hidden)', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 0 })
    expect(screen.getByTestId('refine-cost-hint')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — refineCost over-limit warning', () => {
  it('shows over-limit warning when refineCostExceedsLimit is true', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 10, refineCostExceedsLimit: true })
    expect(screen.getByTestId('refine-cost-over-limit')).toBeInTheDocument()
  })

  it('hides over-limit warning when refineCostExceedsLimit is false', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 4, refineCostExceedsLimit: false })
    expect(screen.queryByTestId('refine-cost-over-limit')).not.toBeInTheDocument()
  })

  it('hides over-limit warning when refineCostExceedsLimit is omitted', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 4 })
    expect(screen.queryByTestId('refine-cost-over-limit')).not.toBeInTheDocument()
  })

  it('shows cost hint alongside over-limit warning when both apply', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 10, refineCostExceedsLimit: true })
    expect(screen.getByTestId('refine-cost-hint')).toBeInTheDocument()
    expect(screen.getByTestId('refine-cost-over-limit')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — execute button gate', () => {
  it('is disabled when refineCostExceedsLimit is true', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 30, refineCostExceedsLimit: true })
    expect(screen.getByTestId('execute-node-button')).toBeDisabled()
  })

  it('is not disabled by cost alone when refineCostExceedsLimit is false', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 10, refineCostExceedsLimit: false })
    expect(screen.getByTestId('execute-node-button')).not.toBeDisabled()
  })

  it('is not disabled when refineCostExceedsLimit is omitted', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { refineCost: 10 })
    expect(screen.getByTestId('execute-node-button')).not.toBeDisabled()
  })

  it('is disabled when executeDisabled is true regardless of refineCostExceedsLimit', () => {
    renderPanel(makeNode({ command: '/chat test' }), false, { executeDisabled: true, refineCostExceedsLimit: false })
    expect(screen.getByTestId('execute-node-button')).toBeDisabled()
  })
})

describe('NodeDetailPanel — verdict button', () => {
  const makeMetadata = (overrides = {}) => ({
    winnerForkIndex: 0,
    perCriterionVerdict: [{ criterionId: 'c1', criterion: 'Accuracy', forkRankings: [{ forkIndex: 0, rank: 1 }] }],
    mode: 'strict' as const,
    selectionLayer: 'primary',
    noSignal: false,
    eligible: 2,
    total: 2,
    ...overrides,
  })

  it('shows the verdict button when reliabilityMetadata has non-empty perCriterionVerdict', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { reliabilityMetadata: makeMetadata() })
    expect(screen.getByTestId('verdict-button')).toBeInTheDocument()
  })

  it('hides the verdict button when reliabilityMetadata is absent', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false)
    expect(screen.queryByTestId('verdict-button')).not.toBeInTheDocument()
  })

  it('hides the verdict button when perCriterionVerdict is empty', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, {
      reliabilityMetadata: makeMetadata({ perCriterionVerdict: [] }),
    })
    expect(screen.queryByTestId('verdict-button')).not.toBeInTheDocument()
  })

  it('clicking the verdict button opens the verdict drawer', () => {
    renderPanel(makeNode({ command: '/refine :n=2' }), false, { reliabilityMetadata: makeMetadata() })
    expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('verdict-button'))
    expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — title editor strips reliability suffix', () => {
  // exhaustive suffix-shape coverage for all variant types lives in reliability-suffix.test.ts
  const SUFFIX_SHAPES = [
    ['validate pass first attempt', 'Work item [✓]', 'Work item', '[✓]'],
    ['validate pass after retry', 'Work item [✓ retry-2]', 'Work item', '[✓ retry-2]'],
    ['refine all forks eligible', 'Work item [✓ 2/2]', 'Work item', '[✓ 2/2]'],
    ['refine partial forks eligible', 'Work item [✓ 2/3]', 'Work item', '[✓ 2/3]'],
    ['refine no forks eligible', 'Work item [✗ 0/3]', 'Work item', '[✗ 0/3]'],
    ['validate all retries exhausted', 'Work item [✗ 3 attempts]', 'Work item', '[✗ 3 attempts]'],
    ['no judge signal', 'Work item [⚠ no judge signal]', 'Work item', '[⚠ no judge signal]'],
    [
      'fallback winner committed',
      'Work item [⚠ fallback: 0/2 passed; chose fork-0]',
      'Work item',
      '[⚠ fallback: 0/2 passed; chose fork-0]',
    ],
  ] as const

  describe('editor displays base title — reliability suffix hidden from view', () => {
    it.each(SUFFIX_SHAPES)('%s', (_label, titleWithSuffix, baseTitle) => {
      renderPanel(makeNode({ title: titleWithSuffix }), false)
      expect(screen.getByText(baseTitle)).toBeInTheDocument()
      expect(screen.queryByText(titleWithSuffix)).not.toBeInTheDocument()
    })
  })

  describe('rename re-attaches original suffix — no stacking, no suffix loss', () => {
    it.each(SUFFIX_SHAPES)('%s', (_label, titleWithSuffix, baseTitle, suffix) => {
      const onUpdateNode = vi.fn()
      renderPanel(makeNode({ title: titleWithSuffix }), false, { onUpdateNode })

      fireEvent.doubleClick(screen.getByText(baseTitle))
      const input = screen.getByDisplayValue(baseTitle)
      fireEvent.change(input, { target: { value: 'Renamed' } })
      fireEvent.blur(input)

      expect(onUpdateNode).toHaveBeenCalledWith('n1', { title: `Renamed ${suffix}` })
    })
  })

  it('editor displays full title when node has no reliability suffix', () => {
    renderPanel(makeNode({ title: 'Analyze competitors' }), false)
    expect(screen.getByText('Analyze competitors')).toBeInTheDocument()
  })

  it('rename writes plain title when node title had no reliability suffix', () => {
    const onUpdateNode = vi.fn()
    renderPanel(makeNode({ title: 'Analyze competitors' }), false, { onUpdateNode })

    fireEvent.doubleClick(screen.getByText('Analyze competitors'))
    const input = screen.getByDisplayValue('Analyze competitors')
    fireEvent.change(input, { target: { value: 'Compare rivals' } })
    fireEvent.blur(input)

    expect(onUpdateNode).toHaveBeenCalledWith('n1', { title: 'Compare rivals' })
  })
})
