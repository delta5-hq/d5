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

    it('is enabled for an unregistered slash command when executeDisabled is false', () => {
      const node = makeNode({ command: '/unregistered-alias task' })
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
    ['title is command plus electd suffix', '/chat list', '/chat list [✓ electd]'],
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

describe('NodeDetailPanel — suppressed best-of-N run hint', () => {
  const suppressedMetadata = {
    winnerForkIndex: null as number | null,
    perCriterionVerdict: [],
    mode: 'suppressed' as const,
    selectionLayer: 'none' as const,
    noSignal: false,
    eligible: 1,
    total: 1,
    suppressed: true,
    cause: 'side-effecting-alias',
    requestedN: 3,
    discardedForks: [],
  }

  it('shows the suppression hint when reliabilityMetadata.mode is suppressed', () => {
    renderPanel(makeNode({ command: '/publish :n=3 post' }), false, { reliabilityMetadata: suppressedMetadata })
    expect(screen.getByTestId('suppressed-run-hint')).toBeInTheDocument()
  })

  it('renders the requested N inside the suppression hint', () => {
    renderPanel(makeNode({ command: '/publish :n=3 post' }), false, { reliabilityMetadata: suppressedMetadata })
    expect(screen.getByTestId('suppressed-run-hint')).toHaveTextContent('best-of-N suppressed')
    expect(screen.getByTestId('suppressed-run-hint')).toHaveTextContent(':n=3')
  })

  it('shows the suppression hint when only the suppressed flag is set (mode unchanged)', () => {
    renderPanel(makeNode({ command: '/publish :n=2 post' }), false, {
      reliabilityMetadata: { ...suppressedMetadata, mode: 'strict' as const },
    })
    expect(screen.getByTestId('suppressed-run-hint')).toBeInTheDocument()
  })

  it('does not show the suppression hint for a normal commodity node', () => {
    renderPanel(makeNode({ command: '/chat :n=2 query' }), false, {
      reliabilityMetadata: {
        ...suppressedMetadata,
        mode: 'commodity' as const,
        suppressed: false,
        eligible: 2,
        total: 2,
      },
    })
    expect(screen.queryByTestId('suppressed-run-hint')).not.toBeInTheDocument()
  })

  it('does not show the suppression hint when reliabilityMetadata is absent', () => {
    renderPanel(makeNode({ command: '/chat query' }), false)
    expect(screen.queryByTestId('suppressed-run-hint')).not.toBeInTheDocument()
  })
})

describe('NodeDetailPanel — suppressed hint: cause routing inside suppressed-run-hint', () => {
  const baseSuppressed = {
    winnerForkIndex: null as number | null,
    perCriterionVerdict: [],
    mode: 'suppressed' as const,
    selectionLayer: 'none' as const,
    noSignal: false,
    eligible: 1,
    total: 1,
    suppressed: true,
    requestedN: 3,
    discardedForks: [],
  }

  it('side-effecting-alias cause renders the N-count suppressed hint', () => {
    renderPanel(makeNode({ command: '/publish :n=3 post' }), false, {
      reliabilityMetadata: { ...baseSuppressed, cause: 'side-effecting-alias' },
    })
    const hint = screen.getByTestId('suppressed-run-hint')
    expect(hint).toBeInTheDocument()
    expect(hint).toHaveTextContent('best-of-N suppressed')
    expect(hint).toHaveTextContent(':n=3')
  })

  it('unrecognized or legacy cause falls through to suppressedRunHint — component is cause-agnostic', () => {
    // 'side-effecting-elect-child' was removed in R3-1; component must not branch on cause values
    renderPanel(makeNode({ command: '/chat :n=3 task' }), false, {
      reliabilityMetadata: { ...baseSuppressed, cause: 'side-effecting-elect-child' },
    })
    const hint = screen.getByTestId('suppressed-run-hint')
    expect(hint).toBeInTheDocument()
    expect(hint).toHaveTextContent('best-of-N suppressed')
    expect(hint).toHaveTextContent(':n=3')
  })

  it('any suppressed cause uses the suppressed-run-hint container — no dead branch for legacy causes', () => {
    renderPanel(makeNode({ command: '/chat task' }), false, {
      reliabilityMetadata: { ...baseSuppressed, cause: 'side-effecting-elect-child' },
    })
    expect(screen.getByTestId('suppressed-run-hint')).toBeInTheDocument()
  })
})

describe('NodeDetailPanel — retry-withheld hint', () => {
  // mode:'invalid' with retryWithheld:true is distinct from genuine exhaustion — the hint
  // prevents [✗ N×] from reading identically to an exhausted failure when retry was never replayed.
  const withheldMetadata = {
    winnerForkIndex: null as number | null,
    perCriterionVerdict: [],
    mode: 'invalid' as const,
    selectionLayer: 'primary' as const,
    noSignal: false,
    eligible: 1,
    total: 1,
    retryWithheld: true,
    requestedRetry: 2,
    discardedForks: [],
  }

  it('shows retry-withheld-hint when reliabilityMetadata.retryWithheld is true', () => {
    renderPanel(makeNode({ command: '/qa-mcp run' }), false, { reliabilityMetadata: withheldMetadata })
    expect(screen.getByTestId('retry-withheld-hint')).toBeInTheDocument()
  })

  it('renders the requestedRetry count inside the hint', () => {
    renderPanel(makeNode({ command: '/qa-mcp run' }), false, { reliabilityMetadata: withheldMetadata })
    expect(screen.getByTestId('retry-withheld-hint')).toHaveTextContent('Retry withheld')
    expect(screen.getByTestId('retry-withheld-hint')).toHaveTextContent(':retry=2')
  })

  it('does not show retry-withheld-hint when retryWithheld is absent', () => {
    renderPanel(makeNode({ command: '/chat query' }), false, {
      reliabilityMetadata: { ...withheldMetadata, retryWithheld: undefined },
    })
    expect(screen.queryByTestId('retry-withheld-hint')).not.toBeInTheDocument()
  })

  it('does not show retry-withheld-hint when reliabilityMetadata is absent', () => {
    renderPanel(makeNode({ command: '/chat query' }), false)
    expect(screen.queryByTestId('retry-withheld-hint')).not.toBeInTheDocument()
  })

  it('retry-withheld-hint and suppressed-run-hint are independent — withheld node does not show suppression hint', () => {
    renderPanel(makeNode({ command: '/qa-mcp run' }), false, { reliabilityMetadata: withheldMetadata })
    expect(screen.getByTestId('retry-withheld-hint')).toBeInTheDocument()
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
