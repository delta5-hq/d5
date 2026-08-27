import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import type { ReactNode } from 'react'
import messages from '@shared/lib/intl'
import type { DiscardedFork, ReliabilityMetadata } from '@shared/base-types'
import type { ForkPreviewState } from '@features/workflow-tree/store/fork-preview-state'
import { DiscardedForksDrawer } from '../discarded-forks-drawer'

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en" messages={messages.en}>
    {children}
  </IntlProvider>
)

const discardedFork = (overrides: Partial<DiscardedFork> = {}): DiscardedFork => ({
  forkIndex: 0,
  status: 'ok',
  ...overrides,
})

const forkPreview = (overrides: Partial<ForkPreviewState> = {}): ForkPreviewState => ({
  total: 3,
  forks: [{ forkIndex: 0, status: 'pending' }],
  winnerForkIndex: null,
  ...overrides,
})

const reliabilityMetadata = (overrides: Partial<ReliabilityMetadata> = {}): ReliabilityMetadata => ({
  winnerForkIndex: 1,
  perCriterionVerdict: [],
  mode: 'strict',
  selectionLayer: 'primary',
  noSignal: false,
  eligible: 2,
  total: 3,
  discardedForks: [discardedFork({ forkIndex: 0, status: 'criteria-failed', failedAt: 'must include numbers' })],
  ...overrides,
})

describe('DiscardedForksDrawer', () => {
  describe('renders nothing when no content', () => {
    it('returns null when discardedForks is empty and forkPreview is undefined', () => {
      const { container } = render(
        <DiscardedForksDrawer discardedForks={[]} nodeId="n1" onOpenChange={vi.fn()} open={true} />,
        { wrapper },
      )
      expect(container.firstChild).toBeNull()
    })

    it('returns null when both props are absent', () => {
      const { container } = render(<DiscardedForksDrawer nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(container.firstChild).toBeNull()
    })
  })

  describe('with discardedForks data (post-execution)', () => {
    it('renders a row for each discarded fork', () => {
      render(
        <DiscardedForksDrawer
          discardedForks={[discardedFork({ forkIndex: 1 }), discardedFork({ forkIndex: 2 })]}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(screen.getByTestId('discarded-fork-1')).toBeDefined()
      expect(screen.getByTestId('discarded-fork-2')).toBeDefined()
    })

    it.each([
      {
        name: 'criteria failure criterion',
        fork: discardedFork({ forkIndex: 0, status: 'criteria-failed', failedAt: 'must include numbers' }),
        expected: /must include numbers/,
      },
      {
        name: 'runtime failure reason',
        fork: discardedFork({ forkIndex: 0, status: 'runtime-failed', reason: 'network timeout' }),
        expected: /network timeout/,
      },
      {
        name: 'bounded validation attempts',
        fork: discardedFork({ forkIndex: 0, status: 'criteria-failed', attempts: 4 }),
        expected: /4 attempts/i,
      },
    ])('shows optional diagnostic field: $name', ({ fork, expected }) => {
      render(<DiscardedForksDrawer discardedForks={[fork]} nodeId="n1" onOpenChange={vi.fn()} open={true} />, {
        wrapper,
      })
      expect(screen.getByText(expected)).toBeDefined()
    })

    it.each([
      {
        winnerForkIndex: 0,
        discardedIndexes: [1, 2],
        expectedOrder: ['discarded-fork-0', 'discarded-fork-1', 'discarded-fork-2'],
      },
      {
        winnerForkIndex: 2,
        discardedIndexes: [0, 1],
        expectedOrder: ['discarded-fork-0', 'discarded-fork-1', 'discarded-fork-2'],
      },
      {
        winnerForkIndex: 1,
        discardedIndexes: [2, 0],
        expectedOrder: ['discarded-fork-0', 'discarded-fork-1', 'discarded-fork-2'],
      },
    ])(
      'renders a complete sorted stored fork set for winner $winnerForkIndex',
      ({ winnerForkIndex, discardedIndexes, expectedOrder }) => {
        render(
          <DiscardedForksDrawer
            discardedForks={discardedIndexes.map(forkIndex => discardedFork({ forkIndex }))}
            metadata={reliabilityMetadata({ winnerForkIndex })}
            nodeId="n1"
            onOpenChange={vi.fn()}
            open={true}
          />,
          { wrapper },
        )

        const rowIds = screen.getAllByTestId(/discarded-fork-/).map(row => row.getAttribute('data-testid'))
        expect(rowIds).toEqual(expectedOrder)
        expect(screen.getByText(/selected winner/i)).toBeDefined()
      },
    )

    it('deduplicates winner and discarded rows by fork index instead of rendering contradictory statuses', () => {
      render(
        <DiscardedForksDrawer
          discardedForks={[discardedFork({ forkIndex: 1, status: 'criteria-failed' })]}
          metadata={reliabilityMetadata({ winnerForkIndex: 1 })}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(screen.getAllByTestId('discarded-fork-1')).toHaveLength(1)
      expect(screen.getByText(/selected winner/i)).toBeDefined()
    })

    it('shows selection, failure, and judge-input diagnostics from reliability metadata', () => {
      render(
        <DiscardedForksDrawer
          metadata={reliabilityMetadata({
            failureCause: 'no-judge-signal',
            judgeInput: {
              candidateCount: 2,
              perForkBudgetChars: 1200,
              degradedInput: false,
              resolvedJudgeFamilies: ['openai'],
            },
          })}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(screen.getByTestId('fork-inspector-summary').textContent).toMatch(/2 of 3 forks eligible/i)
      expect(screen.getByTestId('fork-inspector-summary').textContent).toMatch(/no-judge-signal/i)
      expect(screen.getByTestId('fork-inspector-summary').textContent).toMatch(/1200/)
    })
  })

  describe('with forkPreview (live during execution)', () => {
    it('renders pending fork rows when forks are running', () => {
      const preview = forkPreview({
        total: 2,
        forks: [
          { forkIndex: 0, status: 'pending' },
          { forkIndex: 1, status: 'pending' },
        ],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.getByTestId('discarded-fork-0')).toBeDefined()
      expect(screen.getByTestId('discarded-fork-1')).toBeDefined()
    })

    it('shows total count label when forkPreview is present', () => {
      render(
        <DiscardedForksDrawer forkPreview={forkPreview({ total: 5 })} nodeId="n1" onOpenChange={vi.fn()} open={true} />,
        { wrapper },
      )
      expect(screen.getByText(/5 forks/i)).toBeDefined()
    })

    it('transitions settled forks out of pending display', () => {
      const preview = forkPreview({
        total: 2,
        forks: [
          { forkIndex: 0, status: 'ok' },
          { forkIndex: 1, status: 'pending' },
        ],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.getByText(/passed/i)).toBeDefined()
      expect(screen.getByText(/running/i)).toBeDefined()
    })

    it('live runtime-failed fork shows reason text while another fork is still pending', () => {
      render(
        <DiscardedForksDrawer
          forkPreview={forkPreview({
            total: 2,
            forks: [
              { forkIndex: 0, status: 'runtime-failed', reason: 'provider unavailable' },
              { forkIndex: 1, status: 'pending' },
            ],
            winnerForkIndex: null,
          })}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(screen.getByText('provider unavailable')).toBeDefined()
    })

    it('live criteria-failed fork shows criteria-failed status text while another fork is still pending', () => {
      render(
        <DiscardedForksDrawer
          forkPreview={forkPreview({
            total: 2,
            forks: [
              { forkIndex: 0, status: 'criteria-failed', failedAt: 'must be concise' },
              { forkIndex: 1, status: 'pending' },
            ],
            winnerForkIndex: null,
          })}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(screen.getByText(/criteria failed/i)).toBeDefined()
    })
  })

  describe('leaf output content (live preview)', () => {
    it('renders leaf content for a settled ok fork', () => {
      const preview = forkPreview({
        total: 2,
        forks: [
          { forkIndex: 0, status: 'ok', leafOutputs: [{ nodeId: 'n1', content: 'Analysis result here' }] },
          { forkIndex: 1, status: 'pending' },
        ],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.getByText('Analysis result here')).toBeDefined()
    })

    it('renders leaf content for a criteria-failed fork', () => {
      const preview = forkPreview({
        total: 2,
        forks: [
          {
            forkIndex: 0,
            status: 'criteria-failed',
            failedAt: 'must include numbers',
            leafOutputs: [{ nodeId: 'n1', content: 'Output without numbers' }],
          },
          { forkIndex: 1, status: 'pending' },
        ],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.getByText('Output without numbers')).toBeDefined()
    })

    it('renders no leaf content for a pending fork', () => {
      const preview = forkPreview({
        total: 1,
        forks: [{ forkIndex: 0, status: 'pending' }],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.queryByTestId('fork-leaf-content-0')).toBeNull()
    })

    it('renders no leaf content for a runtime-failed fork (no content available)', () => {
      const preview = forkPreview({
        total: 2,
        forks: [
          { forkIndex: 0, status: 'runtime-failed', reason: 'provider down' },
          { forkIndex: 1, status: 'pending' },
        ],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.queryByTestId('fork-leaf-content-0')).toBeNull()
    })

    it('renders leaf content for multiple settled forks independently', () => {
      const preview = forkPreview({
        total: 2,
        forks: [
          { forkIndex: 0, status: 'ok', leafOutputs: [{ nodeId: 'n0', content: 'Fork zero output' }] },
          { forkIndex: 1, status: 'ok', leafOutputs: [{ nodeId: 'n1', content: 'Fork one output' }] },
        ],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.getByText('Fork zero output')).toBeDefined()
      expect(screen.getByText('Fork one output')).toBeDefined()
    })
  })

  describe('nodeId attribute', () => {
    it('sets data-node-id on the sheet content from the nodeId prop', () => {
      render(
        <DiscardedForksDrawer
          discardedForks={[discardedFork()]}
          nodeId="node-xyz"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      const content = screen.getByTestId('discarded-forks-drawer')
      expect(content.getAttribute('data-node-id')).toBe('node-xyz')
    })
  })

  describe('content source priority', () => {
    it('falls back to discardedForks when winnerForkIndex is set (elect_complete has fired)', () => {
      render(
        <DiscardedForksDrawer
          discardedForks={[discardedFork({ forkIndex: 7 })]}
          forkPreview={forkPreview({
            total: 1,
            forks: [{ forkIndex: 0, status: 'ok' }],
            winnerForkIndex: 0,
          })}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(screen.getByTestId('discarded-fork-7')).toBeDefined()
    })

    it('returns null when forkPreview has empty forks and no discardedForks', () => {
      const { container } = render(
        <DiscardedForksDrawer
          forkPreview={forkPreview({ total: 3, forks: [], winnerForkIndex: null })}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(container.firstChild).toBeNull()
    })

    it('live mode persists when winnerForkIndex is null even after all forks settle', () => {
      const preview = forkPreview({
        total: 2,
        forks: [
          { forkIndex: 0, status: 'ok' },
          { forkIndex: 1, status: 'criteria-failed', failedAt: 'criterion' },
        ],
        winnerForkIndex: null,
      })
      render(<DiscardedForksDrawer forkPreview={preview} nodeId="n1" onOpenChange={vi.fn()} open={true} />, { wrapper })
      expect(screen.getByTestId('discarded-fork-0')).toBeDefined()
      expect(screen.getByTestId('discarded-fork-1')).toBeDefined()
    })

    it('live forks take priority over discardedForks when winnerForkIndex is null', () => {
      const preview = forkPreview({
        total: 1,
        forks: [{ forkIndex: 0, status: 'ok' }],
        winnerForkIndex: null,
      })
      render(
        <DiscardedForksDrawer
          discardedForks={[discardedFork({ forkIndex: 99 })]}
          forkPreview={preview}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={true}
        />,
        { wrapper },
      )
      expect(screen.getByTestId('discarded-fork-0')).toBeDefined()
      expect(screen.queryByTestId('discarded-fork-99')).toBeNull()
    })
  })

  describe('closed drawer', () => {
    it('does not show list content when open=false', () => {
      render(
        <DiscardedForksDrawer
          discardedForks={[discardedFork({ forkIndex: 0 })]}
          nodeId="n1"
          onOpenChange={vi.fn()}
          open={false}
        />,
        { wrapper },
      )
      expect(screen.queryByTestId('discarded-forks-list')).toBeNull()
    })
  })
})
