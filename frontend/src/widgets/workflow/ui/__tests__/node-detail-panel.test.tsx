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

type PanelProps = Parameters<typeof NodeDetailPanel>[0]
type PanelOverrides = Partial<PanelProps>

/* Both suites' call shapes must keep working:
   renderPanel(node, overrides?)      — workflow-editor line
   renderPanel(node, isPrompt, overrides?) — reliability line */
function makeProps(
  node: NodeData,
  isPromptOrOverrides: boolean | PanelOverrides = {},
  overrides: PanelOverrides = {},
): PanelProps {
  const isPrompt = typeof isPromptOrOverrides === 'boolean' ? isPromptOrOverrides : undefined
  const resolved = typeof isPromptOrOverrides === 'boolean' ? overrides : isPromptOrOverrides
  return {
    node,
    ...(isPrompt === undefined ? {} : { isPrompt }),
    onUpdateNode: vi.fn(),
    onEnterInCommand: vi.fn(),
    onCtrlEnterInCommand: vi.fn(),
    onShiftCtrlEnterInCommand: vi.fn(),
    onClose: vi.fn(),
    onExecute: vi.fn(),
    onAbort: vi.fn(),
    isExecuting: false,
    executeDisabled: false,
    ...resolved,
  }
}

function renderPanel(
  node: NodeData,
  isPromptOrOverrides: boolean | PanelOverrides = {},
  overrides: PanelOverrides = {},
) {
  const props = makeProps(node, isPromptOrOverrides, overrides)
  const result = render(<NodeDetailPanel {...props} />, { wrapper })
  const rerenderPanel = (
    nextNode: NodeData,
    nextIsPromptOrOverrides: boolean | PanelOverrides = isPromptOrOverrides,
    nextOverrides: PanelOverrides = overrides,
  ) =>
    result.rerender(
      <IntlProvider locale="en" messages={messages.en}>
        <NodeDetailPanel {...makeProps(nextNode, nextIsPromptOrOverrides, nextOverrides)} />
      </IntlProvider>,
    )
  return { ...result, rerenderPanel, props }
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

describe('NodeDetailPanel — reliability command grammar', () => {
  it.each([
    ['/elect :n=3 must cite sources', /Move the criterion to a sibling \/validate cell/i],
    ['/validate :retry=2 criterion', /Wrap the generating command with \/refine/i],
    ['/refine :n=3 unexpected', /Use \/refine :n=N without trailing text/i],
  ])('blocks button execution and shows a localized reason for %s', (command, expectedMessage) => {
    const { props } = renderPanel(makeNode({ command }), false)

    expect(screen.getByTestId('execute-node-button')).toBeDisabled()
    expect(screen.getByTestId('command-validation-error')).toHaveTextContent(expectedMessage)
    fireEvent.click(screen.getByTestId('execute-node-button'))
    expect(props.onExecute).not.toHaveBeenCalled()
  })

  it('keeps a neighboring slash alias executable and shows no reserved-command error', () => {
    renderPanel(makeNode({ command: '/refinement :n=3' }), false)
    expect(screen.getByTestId('execute-node-button')).not.toBeDisabled()
    expect(screen.queryByTestId('command-validation-error')).not.toBeInTheDocument()
  })
})

describe('NodeDetailPanel — target layout contract', () => {
  // The merge target removed the settings and preview chrome and the in-panel node
  // action buttons; the panel renders its output and command sections directly.
  it('renders the output and command sections directly, with no settings or preview chrome', () => {
    renderPanel(makeNode({ command: '/chat test' }), false)
    expect(screen.getByTestId('output-section')).toBeInTheDocument()
    expect(screen.getByTestId('command-section')).toBeInTheDocument()
    expect(screen.queryByTestId('settings-trigger')).not.toBeInTheDocument()
    expect(screen.queryByTestId('preview-trigger')).not.toBeInTheDocument()
    expect(screen.queryByTestId('add-child-node-button')).not.toBeInTheDocument()
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

describe('NodeDetailPanel — electCost hint', () => {
  it('shows the cost hint when electCost is a positive number', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 4 })
    expect(screen.getByTestId('elect-cost-hint')).toBeInTheDocument()
  })

  it('hides the cost hint when electCost is null', () => {
    renderPanel(makeNode({ command: '/chat query' }), false, { electCost: null })
    expect(screen.queryByTestId('elect-cost-hint')).not.toBeInTheDocument()
  })

  it('hides the cost hint when electCost prop is omitted', () => {
    renderPanel(makeNode({ command: '/chat query' }), false)
    expect(screen.queryByTestId('elect-cost-hint')).not.toBeInTheDocument()
  })

  it('shows the cost hint when electCost is 0 (boundary: only null is hidden)', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 0 })
    expect(screen.getByTestId('elect-cost-hint')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — electCost over-limit warning', () => {
  it('shows over-limit warning when electCostExceedsLimit is true', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 10, electCostExceedsLimit: true })
    expect(screen.getByTestId('elect-cost-over-limit')).toBeInTheDocument()
  })

  it('hides over-limit warning when electCostExceedsLimit is false', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 4, electCostExceedsLimit: false })
    expect(screen.queryByTestId('elect-cost-over-limit')).not.toBeInTheDocument()
  })

  it('hides over-limit warning when electCostExceedsLimit is omitted', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 4 })
    expect(screen.queryByTestId('elect-cost-over-limit')).not.toBeInTheDocument()
  })

  it('shows cost hint alongside over-limit warning when both apply', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 10, electCostExceedsLimit: true })
    expect(screen.getByTestId('elect-cost-hint')).toBeInTheDocument()
    expect(screen.getByTestId('elect-cost-over-limit')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — execute button gate', () => {
  it('is disabled when electCostExceedsLimit is true', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 30, electCostExceedsLimit: true })
    expect(screen.getByTestId('execute-node-button')).toBeDisabled()
  })

  it('is not disabled by cost alone when electCostExceedsLimit is false', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 10, electCostExceedsLimit: false })
    expect(screen.getByTestId('execute-node-button')).not.toBeDisabled()
  })

  it('is not disabled when electCostExceedsLimit is omitted', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { electCost: 10 })
    expect(screen.getByTestId('execute-node-button')).not.toBeDisabled()
  })

  it('is disabled when executeDisabled is true regardless of electCostExceedsLimit', () => {
    renderPanel(makeNode({ command: '/chat test' }), false, { executeDisabled: true, electCostExceedsLimit: false })
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
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { reliabilityMetadata: makeMetadata() })
    expect(screen.getByTestId('verdict-button')).toBeInTheDocument()
  })

  it('hides the verdict button when reliabilityMetadata is absent', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false)
    expect(screen.queryByTestId('verdict-button')).not.toBeInTheDocument()
  })

  it('hides the verdict button when perCriterionVerdict is empty', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, {
      reliabilityMetadata: makeMetadata({ perCriterionVerdict: [] }),
    })
    expect(screen.queryByTestId('verdict-button')).not.toBeInTheDocument()
  })

  it('clicking the verdict button opens the verdict drawer', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, { reliabilityMetadata: makeMetadata() })
    expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('verdict-button'))
    expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()
  })

  it('shows the forks inspector button for reliability metadata even when there are no discarded forks', () => {
    renderPanel(makeNode({ command: '/elect :n=2' }), false, {
      reliabilityMetadata: makeMetadata({ discardedForks: [], perCriterionVerdict: [] }),
    })
    expect(screen.getByTestId('forks-button')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — title editor strips reliability suffix', () => {
  // exhaustive suffix-shape coverage for all variant types lives in reliability-suffix.test.ts
  const SUFFIX_SHAPES = [
    ['validate pass first attempt', 'Work item [✓]', 'Work item', '[✓]'],
    ['validate pass after N retries', 'Work item [✓ +2]', 'Work item', '[✓ +2]'],
    ['elect/commodity all succeeded', 'Work item [✓ 2/2]', 'Work item', '[✓ 2/2]'],
    ['elect/commodity partial success', 'Work item [✓ 2/3]', 'Work item', '[✓ 2/3]'],
    ['commodity partial with warning', 'Work item [✓ 1/3 ⚠]', 'Work item', '[✓ 1/3 ⚠]'],
    ['elect/commodity all failed', 'Work item [✗ 0/3]', 'Work item', '[✗ 0/3]'],
    ['validate all retries exhausted', 'Work item [✗ 3×]', 'Work item', '[✗ 3×]'],
    ['validate invalid criterion', 'Work item [✗ !]', 'Work item', '[✗ !]'],
    ['no judge signal', 'Work item [⚠ ∅]', 'Work item', '[⚠ ∅]'],
    ['fallback winner committed', 'Work item [⚠ 0/2]', 'Work item', '[⚠ 0/2]'],
    // historical engine shapes (v1 — still stripped for backward compat)
    ['v1 validate pass after retry', 'Work item [✓ retry-2]', 'Work item', '[✓ retry-2]'],
    ['v1 validate all retries exhausted', 'Work item [✗ 3 attempts]', 'Work item', '[✗ 3 attempts]'],
    ['v1 no judge signal', 'Work item [⚠ no judge signal]', 'Work item', '[⚠ no judge signal]'],
    [
      'v1 fallback winner committed',
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

describe('NodeDetailPanel — commodity ceiling hint visibility', () => {
  describe('hint present: plain LLM command with :n= at or above minimum (N ≥ 2)', () => {
    it.each([
      ['/chat :n=2 query', 'minimum active value'],
      ['/chat :n=3 query', 'common 3-fork case'],
      ['/chat :n=10 query', 'at COMMODITY_N_MAX cap'],
      ['/claude :n=2 query', 'non-chat LLM family with :n=2'],
      ['/chat :n=2', 'no task text after param'],
      ['/chat :n=2  ', 'trailing whitespace after param'],
    ])('%s (%s)', command => {
      renderPanel(makeNode({ command }), false)
      expect(screen.getByTestId('commodity-ceiling-hint')).toBeInTheDocument()
    })
  })

  describe('hint absent: :n= below minimum or missing on a plain command', () => {
    it.each([
      ['/chat query', 'no :n= present'],
      ['/chat :n=1 query', ':n=1 is below minimum'],
      ['/chat :n=0 query', ':n=0 is below minimum'],
      ['/chat :n=abc query', 'non-numeric N is not a commodity fork count'],
      ['/chat :n= query', 'empty N after :n= is not a commodity fork count'],
    ])('%s (%s)', command => {
      renderPanel(makeNode({ command }), false)
      expect(screen.queryByTestId('commodity-ceiling-hint')).not.toBeInTheDocument()
    })
  })

  describe('hint absent: non-commodity cell prefixes ignore :n= value', () => {
    it.each([
      '/elect :n=3',
      '/validate :n=2 must mention revenue',
      '/foreach :n=3 items',
      '/steps :n=2',
      '/switch :n=5 condition',
      '/case :n=2 label',
      '/summarize :n=3',
      '/memorize :n=2',
      '/outline :n=3',
    ])('%s', command => {
      renderPanel(makeNode({ command }), false)
      expect(screen.queryByTestId('commodity-ceiling-hint')).not.toBeInTheDocument()
    })
  })

  describe('hint toggles live on command change without page reload', () => {
    it('appears when :n=N is added to a commodity command', () => {
      const { rerenderPanel } = renderPanel(makeNode({ command: '/chat query' }), false)
      expect(screen.queryByTestId('commodity-ceiling-hint')).not.toBeInTheDocument()
      rerenderPanel(makeNode({ command: '/chat :n=2 query' }), false)
      expect(screen.getByTestId('commodity-ceiling-hint')).toBeInTheDocument()
    })

    it('disappears when :n=N is removed from a commodity command', () => {
      const { rerenderPanel } = renderPanel(makeNode({ command: '/chat :n=2 query' }), false)
      expect(screen.getByTestId('commodity-ceiling-hint')).toBeInTheDocument()
      rerenderPanel(makeNode({ command: '/chat query' }), false)
      expect(screen.queryByTestId('commodity-ceiling-hint')).not.toBeInTheDocument()
    })

    it('disappears when command changes from commodity :n=N to non-commodity :n=N', () => {
      const { rerenderPanel } = renderPanel(makeNode({ command: '/chat :n=2 query' }), false)
      expect(screen.getByTestId('commodity-ceiling-hint')).toBeInTheDocument()
      rerenderPanel(makeNode({ command: '/elect :n=2 query' }), false)
      expect(screen.queryByTestId('commodity-ceiling-hint')).not.toBeInTheDocument()
    })
  })
})

describe('NodeDetailPanel — nested-reliability suppressed run hint', () => {
  const suppressedMetadata = {
    winnerForkIndex: null as number | null,
    perCriterionVerdict: [],
    mode: 'suppressed' as const,
    selectionLayer: 'none' as const,
    noSignal: false,
    eligible: 1,
    total: 1,
    requestedN: 3,
    discardedForks: [],
  }

  it('shows the nested-reliability hint when reliabilityMetadata.mode is suppressed', () => {
    renderPanel(makeNode({ command: '/chat :n=3 task' }), false, { reliabilityMetadata: suppressedMetadata })
    const hint = screen.getByTestId('suppressed-run-hint')
    expect(hint).toBeInTheDocument()
    expect(hint).toHaveTextContent('outer reliability fork')
    expect(hint).toHaveTextContent('multiplied generations')
    expect(hint).toHaveTextContent(':n=3')
  })

  it('does not show the hint for a normal commodity node', () => {
    renderPanel(makeNode({ command: '/chat :n=2 query' }), false, {
      reliabilityMetadata: { ...suppressedMetadata, mode: 'commodity' as const, eligible: 2, total: 2 },
    })
    expect(screen.queryByTestId('suppressed-run-hint')).not.toBeInTheDocument()
  })

  it('does not show the hint when reliabilityMetadata is absent', () => {
    renderPanel(makeNode({ command: '/chat query' }), false)
    expect(screen.queryByTestId('suppressed-run-hint')).not.toBeInTheDocument()
  })
})

describe('NodeDetailPanel — verdict drawer: trigger gate', () => {
  const reliabilityMetadata = {
    winnerForkIndex: null as number | null,
    perCriterionVerdict: [{ criterionId: 'c1', criterion: 'Accuracy', forkRankings: [{ forkIndex: 0, rank: 1 }] }],
    mode: 'strict' as const,
    selectionLayer: 'primary' as const,
    noSignal: false,
    eligible: 2,
    total: 2,
  }

  describe('opening conditions', () => {
    it('opens when trigger identifies this node and reliability metadata is present', () => {
      renderPanel(makeNode(), false, { openDrawerForNodeId: 'n1', reliabilityMetadata })
      expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()
    })

    it.each<[string, string | undefined]>([
      ['trigger is absent', undefined],
      ['trigger targets a different node', 'other-node'],
    ])('stays closed when %s', (_label, openDrawerForNodeId) => {
      renderPanel(makeNode(), false, { openDrawerForNodeId, reliabilityMetadata })
      expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
    })

    it('stays closed when trigger matches this node but reliability metadata is absent', () => {
      renderPanel(makeNode(), false, { openDrawerForNodeId: 'n1' })
      expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
    })
  })

  describe('parent notification — onDrawerOpened', () => {
    it.each<[string, typeof reliabilityMetadata | undefined]>([
      ['reliability metadata present', reliabilityMetadata],
      ['reliability metadata absent', undefined],
    ])('notifies parent exactly once when trigger matches this node and %s', (_label, meta) => {
      const onDrawerOpened = vi.fn()
      renderPanel(makeNode(), false, { openDrawerForNodeId: 'n1', reliabilityMetadata: meta, onDrawerOpened })
      expect(onDrawerOpened).toHaveBeenCalledTimes(1)
    })

    it.each<[string, string | undefined]>([
      ['trigger is absent', undefined],
      ['trigger targets a different node', 'other-node'],
    ])('does not notify parent when %s', (_label, openDrawerForNodeId) => {
      const onDrawerOpened = vi.fn()
      renderPanel(makeNode(), false, { openDrawerForNodeId, reliabilityMetadata, onDrawerOpened })
      expect(onDrawerOpened).not.toHaveBeenCalled()
    })
  })

  describe('trigger is a one-shot signal', () => {
    it('trigger arriving via prop update after mount opens the drawer', () => {
      const { rerender } = render(
        <NodeDetailPanel {...makeProps(makeNode(), false, { openDrawerForNodeId: undefined, reliabilityMetadata })} />,
        { wrapper },
      )
      expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()

      rerender(
        <NodeDetailPanel {...makeProps(makeNode(), false, { openDrawerForNodeId: 'n1', reliabilityMetadata })} />,
      )
      expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()
    })

    it('drawer stays open after trigger is consumed and cleared', () => {
      const { rerender } = render(
        <NodeDetailPanel
          {...makeProps(makeNode(), false, { openDrawerForNodeId: 'n1', reliabilityMetadata, onDrawerOpened: vi.fn() })}
        />,
        { wrapper },
      )
      expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()

      rerender(
        <NodeDetailPanel {...makeProps(makeNode(), false, { openDrawerForNodeId: undefined, reliabilityMetadata })} />,
      )
      expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()
    })

    it('a subsequent trigger re-opens the drawer after the previous one was consumed', () => {
      const onDrawerOpened = vi.fn()
      const props = (trigger: string | undefined) =>
        makeProps(makeNode(), false, { openDrawerForNodeId: trigger, reliabilityMetadata, onDrawerOpened })

      const { rerender } = render(<NodeDetailPanel {...props('n1')} />, { wrapper })
      expect(onDrawerOpened).toHaveBeenCalledTimes(1)

      rerender(<NodeDetailPanel {...props(undefined)} />)
      rerender(<NodeDetailPanel {...props('n1')} />)
      expect(onDrawerOpened).toHaveBeenCalledTimes(2)
    })

    it('drawer stays closed when trigger was consumed without opening and reliability metadata later appears', () => {
      const onDrawerOpened = vi.fn()
      const { rerender } = render(
        <NodeDetailPanel {...makeProps(makeNode(), false, { openDrawerForNodeId: 'n1', onDrawerOpened })} />,
        { wrapper },
      )
      expect(onDrawerOpened).toHaveBeenCalledTimes(1)
      expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()

      rerender(
        <NodeDetailPanel
          {...makeProps(makeNode(), false, { openDrawerForNodeId: undefined, reliabilityMetadata, onDrawerOpened })}
        />,
      )
      expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
    })
  })

  describe('mount and navigation behavior', () => {
    it('drawer is closed on initial mount when no trigger is set', () => {
      renderPanel(makeNode(), false, { reliabilityMetadata })
      expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
    })

    it('drawer is closed when remounted without a pending trigger', () => {
      const { unmount } = renderPanel(makeNode(), false, {
        openDrawerForNodeId: 'n1',
        reliabilityMetadata,
        onDrawerOpened: vi.fn(),
      })
      expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()
      unmount()

      renderPanel(makeNode(), false, { openDrawerForNodeId: undefined, reliabilityMetadata })
      expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
    })
  })
})
