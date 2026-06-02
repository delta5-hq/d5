import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import type { ReactNode } from 'react'
import messages from '@shared/lib/intl'
import type { ReliabilityMetadata } from '@shared/base-types'
import { CriterionVerdictDrawer } from '../criterion-verdict-drawer'

const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en" messages={messages.en}>
    {children}
  </IntlProvider>
)

function makeMetadata(overrides: Partial<ReliabilityMetadata> = {}): ReliabilityMetadata {
  return {
    winnerForkIndex: 0,
    perCriterionVerdict: [],
    mode: 'strict',
    selectionLayer: 'primary',
    noSignal: false,
    eligible: 2,
    total: 2,
    ...overrides,
  }
}

function renderDrawer(metadata: ReliabilityMetadata, open = true, onOpenChange = vi.fn()) {
  return render(<CriterionVerdictDrawer metadata={metadata} onOpenChange={onOpenChange} open={open} />, { wrapper })
}

describe('CriterionVerdictDrawer — mounting', () => {
  it('renders drawer content when open=true', () => {
    renderDrawer(makeMetadata())
    expect(screen.getByTestId('criterion-verdict-drawer')).toBeInTheDocument()
  })

  it('does not render drawer content when open=false', () => {
    renderDrawer(makeMetadata(), false)
    expect(screen.queryByTestId('criterion-verdict-drawer')).not.toBeInTheDocument()
  })
})

describe('CriterionVerdictDrawer — metadata summary', () => {
  it('shows mode as "strict" when mode is strict', () => {
    renderDrawer(makeMetadata({ mode: 'strict' }))
    expect(screen.getByText(/strict/i)).toBeInTheDocument()
  })

  it('shows mode as "fallback" when mode is fallback', () => {
    renderDrawer(makeMetadata({ mode: 'fallback' }))
    expect(screen.getByText(/fallback/i)).toBeInTheDocument()
  })

  it('shows eligible and total fork counts', () => {
    renderDrawer(makeMetadata({ eligible: 3, total: 5 }))
    const container = screen.getByTestId('criterion-verdict-drawer')
    expect(container.textContent).toMatch(/3/)
    expect(container.textContent).toMatch(/5/)
  })

  it('shows noSignal warning when noSignal is true', () => {
    renderDrawer(makeMetadata({ noSignal: true }))
    expect(screen.getByText(/No juror rankings collected/i)).toBeInTheDocument()
  })

  it('hides noSignal warning when noSignal is false', () => {
    renderDrawer(makeMetadata({ noSignal: false }))
    expect(screen.queryByText(/No juror rankings collected/i)).not.toBeInTheDocument()
  })

  it('shows tiebreak warning when tiebreakUsed is true and noSignal is false', () => {
    renderDrawer(makeMetadata({ tiebreakUsed: true, noSignal: false }))
    expect(screen.getByText(/tiebreak/i)).toBeInTheDocument()
  })

  it('hides tiebreak warning when tiebreakUsed is false', () => {
    renderDrawer(makeMetadata({ tiebreakUsed: false }))
    expect(screen.queryByText(/tiebreak/i)).not.toBeInTheDocument()
  })

  it('hides tiebreak warning when noSignal is already true (noSignal takes precedence)', () => {
    renderDrawer(makeMetadata({ tiebreakUsed: true, noSignal: true }))
    expect(screen.getByText(/No juror rankings collected/i)).toBeInTheDocument()
    expect(screen.queryByText(/tiebreak/i)).not.toBeInTheDocument()
  })
})

describe('CriterionVerdictDrawer — criterion list', () => {
  it('renders the criterion text for each entry', () => {
    renderDrawer(
      makeMetadata({
        perCriterionVerdict: [
          { criterionId: 'c1', criterion: 'Accuracy of the answer', forkRankings: [] },
          { criterionId: 'c2', criterion: 'Clarity of explanation', forkRankings: [] },
        ],
      }),
    )
    expect(screen.getByText('Accuracy of the answer')).toBeInTheDocument()
    expect(screen.getByText('Clarity of explanation')).toBeInTheDocument()
  })

  it('renders no fork-rankings section when forkRankings is empty', () => {
    renderDrawer(
      makeMetadata({
        perCriterionVerdict: [{ criterionId: 'c1', criterion: 'Quality', forkRankings: [] }],
      }),
    )
    expect(screen.queryByText(/Fork \d+/i)).not.toBeInTheDocument()
  })

  it('renders fork labels in rank order when forkRankings are present', () => {
    renderDrawer(
      makeMetadata({
        perCriterionVerdict: [
          {
            criterionId: 'c1',
            criterion: 'Quality',
            forkRankings: [
              { forkIndex: 1, rank: 1 },
              { forkIndex: 0, rank: 2 },
            ],
          },
        ],
      }),
    )
    expect(screen.getByText(/Fork 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Fork 1/i)).toBeInTheDocument()
  })

  it('marks the winning fork with "Winner" label', () => {
    renderDrawer(
      makeMetadata({
        winnerForkIndex: 1,
        perCriterionVerdict: [
          {
            criterionId: 'c1',
            criterion: 'Quality',
            forkRankings: [
              { forkIndex: 0, rank: 1 },
              { forkIndex: 1, rank: 2 },
            ],
          },
        ],
      }),
    )
    expect(screen.getByText(/Winner/i)).toBeInTheDocument()
  })

  it('does not show "Winner" label when no fork matches winnerForkIndex', () => {
    renderDrawer(
      makeMetadata({
        winnerForkIndex: 99,
        perCriterionVerdict: [
          {
            criterionId: 'c1',
            criterion: 'Quality',
            forkRankings: [{ forkIndex: 0, rank: 1 }],
          },
        ],
      }),
    )
    expect(screen.queryByText(/Winner/i)).not.toBeInTheDocument()
  })

  it('renders multiple criteria independently', () => {
    renderDrawer(
      makeMetadata({
        perCriterionVerdict: [
          { criterionId: 'c1', criterion: 'Criterion One', forkRankings: [{ forkIndex: 0, rank: 1 }] },
          { criterionId: 'c2', criterion: 'Criterion Two', forkRankings: [{ forkIndex: 0, rank: 1 }] },
        ],
      }),
    )
    expect(screen.getByText('Criterion One')).toBeInTheDocument()
    expect(screen.getByText('Criterion Two')).toBeInTheDocument()
  })
})

describe('CriterionVerdictDrawer — close interaction', () => {
  it('calls onOpenChange(false) when the close button is clicked', () => {
    const onOpenChange = vi.fn()
    renderDrawer(makeMetadata(), true, onOpenChange)
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('CriterionVerdictDrawer — judge quality warnings', () => {
  it('does not render warnings section when judgeQualityWarnings is absent', () => {
    renderDrawer(makeMetadata())
    expect(screen.queryByTestId('judge-quality-warnings')).not.toBeInTheDocument()
  })

  it('does not render warnings section when judgeQualityWarnings is empty', () => {
    renderDrawer(makeMetadata({ judgeQualityWarnings: [] }))
    expect(screen.queryByTestId('judge-quality-warnings')).not.toBeInTheDocument()
  })

  it('renders warnings section with singleProvider warning', () => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [{ condition: 'singleProvider', severity: 'high' }],
      }),
    )
    expect(screen.getByTestId('judge-quality-warnings')).toBeInTheDocument()
    expect(screen.getByText(/Single provider configured/i)).toBeInTheDocument()
  })

  it('renders lowestTierOnly warning text', () => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [{ condition: 'lowestTierOnly', severity: 'medium' }],
      }),
    )
    expect(screen.getByText(/Only lowest-tier models/i)).toBeInTheDocument()
  })

  it('renders juryDuplicates warning text', () => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [{ condition: 'juryDuplicates', severity: 'low' }],
      }),
    )
    expect(screen.getByText(/Jury size exceeds/i)).toBeInTheDocument()
  })

  it('renders fallbackWithWeakJudge warning text', () => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [{ condition: 'fallbackWithWeakJudge', severity: 'high' }],
      }),
    )
    expect(screen.getByText(/Fallback mode with weak judge/i)).toBeInTheDocument()
  })

  it('renders noReasoningMode warning text', () => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [{ condition: 'noReasoningMode', severity: 'medium' }],
      }),
    )
    expect(screen.getByText(/No reasoning-capable model configured/i)).toBeInTheDocument()
  })

  it('renders multiple warnings simultaneously', () => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [
          { condition: 'singleProvider', severity: 'high' },
          { condition: 'lowestTierOnly', severity: 'medium' },
        ],
      }),
    )
    expect(screen.getByText(/Single provider configured/i)).toBeInTheDocument()
    expect(screen.getByText(/Only lowest-tier models/i)).toBeInTheDocument()
  })
})
