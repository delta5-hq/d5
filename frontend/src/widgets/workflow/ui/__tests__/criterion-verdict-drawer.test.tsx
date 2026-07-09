import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import type { ReactNode } from 'react'
import messages from '@shared/lib/intl'
import type { ReliabilityMetadata, JudgeQualityWarning } from '@shared/base-types'
import { CriterionVerdictDrawer } from '../criterion-verdict-drawer'

// ── test infrastructure ──────────────────────────────────────────────────────

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

function drawerContent() {
  return screen.getByTestId('criterion-verdict-drawer').textContent ?? ''
}

// ── mounting ─────────────────────────────────────────────────────────────────

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

// ── mode label ───────────────────────────────────────────────────────────────

describe('CriterionVerdictDrawer — mode label', () => {
  it.each([
    ['strict', 'strict'],
    ['fallback', 'fallback'],
    ['commodity', 'commodity'],
    ['invalid', 'invalid'],
  ] as Array<[ReliabilityMetadata['mode'], string]>)('renders "%s" mode in the header', (mode, expectedText) => {
    renderDrawer(makeMetadata({ mode }))
    expect(drawerContent()).toContain(expectedText)
  })
})

// ── eligible / total label ───────────────────────────────────────────────────

describe('CriterionVerdictDrawer — eligible / total label', () => {
  it('renders "forks passed" wording in strict mode', () => {
    renderDrawer(makeMetadata({ mode: 'strict', eligible: 3, total: 5 }))
    expect(drawerContent()).toMatch(/3 of 5 forks passed/)
  })

  it('renders "forks passed" wording in fallback mode', () => {
    renderDrawer(makeMetadata({ mode: 'fallback', eligible: 1, total: 4 }))
    expect(drawerContent()).toMatch(/1 of 4 forks passed/)
  })

  it('renders "forks succeeded" wording in commodity mode', () => {
    renderDrawer(makeMetadata({ mode: 'commodity', eligible: 2, total: 4 }))
    expect(drawerContent()).toMatch(/2 of 4 forks succeeded/)
  })

  it('suppresses the eligible / total label entirely in invalid mode', () => {
    renderDrawer(makeMetadata({ mode: 'invalid', eligible: 1, total: 2 }))
    const content = drawerContent()
    expect(content).not.toMatch(/forks passed/)
    expect(content).not.toMatch(/forks succeeded/)
  })
})

// ── no-winner label ──────────────────────────────────────────────────────────

describe('CriterionVerdictDrawer — no-winner label', () => {
  it('shows no-winner label when winnerForkIndex is null in strict mode', () => {
    renderDrawer(makeMetadata({ mode: 'strict', winnerForkIndex: null }))
    expect(screen.getByText(/No winner selected/i)).toBeInTheDocument()
  })

  it('shows no-winner label when winnerForkIndex is null in fallback mode', () => {
    renderDrawer(makeMetadata({ mode: 'fallback', winnerForkIndex: null }))
    expect(screen.getByText(/No winner selected/i)).toBeInTheDocument()
  })

  it('suppresses no-winner label in commodity mode regardless of winnerForkIndex', () => {
    renderDrawer(makeMetadata({ mode: 'commodity', winnerForkIndex: null }))
    expect(screen.queryByText(/No winner selected/i)).not.toBeInTheDocument()
  })

  it('suppresses no-winner label in invalid mode regardless of winnerForkIndex', () => {
    renderDrawer(makeMetadata({ mode: 'invalid', winnerForkIndex: null }))
    expect(screen.queryByText(/No winner selected/i)).not.toBeInTheDocument()
  })

  it('suppresses no-winner label when a winner is present', () => {
    renderDrawer(makeMetadata({ mode: 'strict', winnerForkIndex: 0 }))
    expect(screen.queryByText(/No winner selected/i)).not.toBeInTheDocument()
  })
})

// ── commodity outcome warnings ───────────────────────────────────────────────

describe('CriterionVerdictDrawer — commodity outcome warnings', () => {
  it('renders partial-success warning with accurate eligible, total, and failed counts', () => {
    renderDrawer(makeMetadata({ mode: 'commodity', eligible: 1, total: 3 }))
    const content = drawerContent()
    expect(content).toMatch(/Partial success/i)
    expect(content).toMatch(/1 of 3/)
    expect(content).toMatch(/2 failed/i)
  })

  it('renders all-failed warning encoding the total count when eligible is 0', () => {
    renderDrawer(makeMetadata({ mode: 'commodity', eligible: 0, total: 3 }))
    expect(drawerContent()).toMatch(/All 3 parallel forks failed/i)
  })

  it('renders neither commodity warning when all forks passed', () => {
    renderDrawer(makeMetadata({ mode: 'commodity', eligible: 3, total: 3 }))
    const content = drawerContent()
    expect(content).not.toMatch(/Partial success/i)
    expect(content).not.toMatch(/parallel forks failed/i)
  })

  it('suppresses commodity outcome warnings in non-commodity modes', () => {
    renderDrawer(makeMetadata({ mode: 'strict', eligible: 1, total: 3 }))
    const content = drawerContent()
    expect(content).not.toMatch(/Partial success/i)
    expect(content).not.toMatch(/parallel forks failed/i)
  })
})

// ── invalid failure causes ───────────────────────────────────────────────────

describe('CriterionVerdictDrawer — invalid failure causes', () => {
  it.each([
    ['missing-parent', /This command requires a parent cell/i],
    ['invalid-criteria', /Validate criterion is empty/i],
  ] as Array<[ReliabilityMetadata['failureCause'], RegExp]>)(
    'renders "%s" failure cause explanation',
    (failureCause, expectedText) => {
      renderDrawer(makeMetadata({ mode: 'invalid', failureCause }))
      expect(screen.getByText(expectedText)).toBeInTheDocument()
    },
  )

  it('renders no failure-cause text for causes with no registered explanation', () => {
    renderDrawer(makeMetadata({ mode: 'invalid', failureCause: 'criteria-failed' }))
    const content = drawerContent()
    expect(content).not.toMatch(/This command requires/i)
    expect(content).not.toMatch(/Validate criterion/i)
  })
})

// ── optional signal flags ────────────────────────────────────────────────────

describe('CriterionVerdictDrawer — optional signal flags', () => {
  it('shows fallbackUsed label when fallbackUsed is true', () => {
    renderDrawer(makeMetadata({ fallbackUsed: true }))
    expect(screen.getByText(/Fallback winner committed/i)).toBeInTheDocument()
  })

  it('hides fallbackUsed label when fallbackUsed is absent', () => {
    renderDrawer(makeMetadata())
    expect(screen.queryByText(/Fallback winner committed/i)).not.toBeInTheDocument()
  })

  it('shows generatorOnlyJudge label when generatorOnlyJudge is true', () => {
    renderDrawer(makeMetadata({ generatorOnlyJudge: true }))
    expect(screen.getByText(/Generator and judge share the same provider/i)).toBeInTheDocument()
  })

  it('hides generatorOnlyJudge label when generatorOnlyJudge is absent', () => {
    renderDrawer(makeMetadata())
    expect(screen.queryByText(/Generator and judge share/i)).not.toBeInTheDocument()
  })

  it('shows judgeReasoningRequested label when judgeReasoningRequested is true', () => {
    renderDrawer(makeMetadata({ judgeReasoningRequested: true }))
    expect(screen.getByText(/Extended judge reasoning requested/i)).toBeInTheDocument()
  })

  it('hides judgeReasoningRequested label when judgeReasoningRequested is absent', () => {
    renderDrawer(makeMetadata())
    expect(screen.queryByText(/Extended judge reasoning/i)).not.toBeInTheDocument()
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

  it('noSignal takes precedence over tiebreakUsed — shows noSignal, hides tiebreak', () => {
    renderDrawer(makeMetadata({ tiebreakUsed: true, noSignal: true }))
    expect(screen.getByText(/No juror rankings collected/i)).toBeInTheDocument()
    expect(screen.queryByText(/tiebreak/i)).not.toBeInTheDocument()
  })
})

// ── criterion list ───────────────────────────────────────────────────────────

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

  it('marks the winning fork with a winner label', () => {
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
    expect(screen.getByText(/\(winner\)/i)).toBeInTheDocument()
  })

  it.each([
    { winnerForkIndex: 0, winnerRank: 1, expected: /Winner ranked #1 of 3/i },
    { winnerForkIndex: 1, winnerRank: 2, expected: /Winner ranked #2 of 3/i },
    { winnerForkIndex: 2, winnerRank: 3, expected: /Winner ranked #3 of 3/i },
  ])(
    'shows criterion-level winner rank evidence for winner fork $winnerForkIndex at rank $winnerRank',
    ({ winnerForkIndex, winnerRank, expected }) => {
      renderDrawer(
        makeMetadata({
          winnerForkIndex,
          perCriterionVerdict: [
            {
              criterionId: 'c1',
              criterion: 'Quality',
              forkRankings: [
                { forkIndex: 0, rank: winnerForkIndex === 0 ? winnerRank : 1 },
                { forkIndex: 1, rank: winnerForkIndex === 1 ? winnerRank : 2 },
                { forkIndex: 2, rank: winnerForkIndex === 2 ? winnerRank : 3 },
              ],
            },
          ],
        }),
      )
      expect(screen.getByText(expected)).toBeInTheDocument()
    },
  )

  it('suppresses winner rank evidence when the winning fork has no ranking in the criterion', () => {
    renderDrawer(
      makeMetadata({
        winnerForkIndex: 9,
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
    expect(screen.queryByText(/Winner ranked/i)).not.toBeInTheDocument()
  })

  it('suppresses winner label when no fork in the criterion matches winnerForkIndex', () => {
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
    expect(screen.queryByText(/\(winner\)/i)).not.toBeInTheDocument()
  })

  it('suppresses winner label and rank evidence when winnerForkIndex is null', () => {
    renderDrawer(
      makeMetadata({
        winnerForkIndex: null,
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
    expect(screen.queryByText(/\(winner\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Winner ranked/i)).not.toBeInTheDocument()
  })

  it('renders multiple criteria independently with their own forkRankings', () => {
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

// ── close interaction ────────────────────────────────────────────────────────

describe('CriterionVerdictDrawer — close interaction', () => {
  it('calls onOpenChange(false) when the close button is clicked', () => {
    const onOpenChange = vi.fn()
    renderDrawer(makeMetadata(), true, onOpenChange)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

// ── judge quality warnings ───────────────────────────────────────────────────

describe('CriterionVerdictDrawer — judge quality warnings', () => {
  it('does not render warnings section when judgeQualityWarnings is absent', () => {
    renderDrawer(makeMetadata())
    expect(screen.queryByTestId('judge-quality-warnings')).not.toBeInTheDocument()
  })

  it('does not render warnings section when judgeQualityWarnings is empty', () => {
    renderDrawer(makeMetadata({ judgeQualityWarnings: [] }))
    expect(screen.queryByTestId('judge-quality-warnings')).not.toBeInTheDocument()
  })

  it.each(['high', 'medium', 'low'] as Array<JudgeQualityWarning['severity']>)(
    'renders severity badge text for severity "%s"',
    severity => {
      renderDrawer(makeMetadata({ judgeQualityWarnings: [{ condition: 'singleProvider', severity }] }))
      expect(screen.getByTestId('judge-quality-warnings').textContent).toContain(severity)
    },
  )

  it.each([
    ['singleProvider', /Single provider configured/i],
    ['lowestTierOnly', /Only lowest-tier models/i],
    ['juryDuplicates', /Jury size exceeds/i],
    ['fallbackWithWeakJudge', /Fallback mode with weak judge/i],
    ['noReasoningMode', /No reasoning-capable model configured/i],
    ['allGateFiltered', /All candidates were structurally rejected/i],
    ['degradedInput', /Per-fork token budget too small/i],
    ['commodityPartialSuccess', /Some parallel forks failed/i],
  ] as Array<[JudgeQualityWarning['condition'], RegExp]>)(
    'renders warning text for condition "%s"',
    (condition, expectedText) => {
      renderDrawer(makeMetadata({ judgeQualityWarnings: [{ condition, severity: 'medium' }] }))
      expect(screen.getByTestId('judge-quality-warnings').textContent).toMatch(expectedText)
    },
  )

  it.each(
    Object.keys(messages.en)
      .filter(k => k.startsWith('workflowTree.verdictDrawer.judgeQualityWarning_'))
      .map(k => k.replace('workflowTree.verdictDrawer.judgeQualityWarning_', '')),
  )('every registered condition "%s" renders non-empty localized text in EN', condition => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [{ condition: condition as JudgeQualityWarning['condition'], severity: 'medium' }],
      }),
    )
    expect(screen.getByTestId('judge-quality-warnings').textContent?.trim().length).toBeGreaterThan(0)
  })

  it.each(
    Object.keys(messages.en)
      .filter(k => k.startsWith('workflowTree.verdictDrawer.judgeQualityWarning_'))
      .map(k => k.replace('workflowTree.verdictDrawer.judgeQualityWarning_', '')),
  )('every registered condition "%s" has a non-empty RU translation', condition => {
    const ruKey = `workflowTree.verdictDrawer.judgeQualityWarning_${condition}`
    const ruText = messages.ru[ruKey]
    expect(typeof ruText).toBe('string')
    expect((ruText as string).trim().length).toBeGreaterThan(0)
  })

  it('renders all warnings simultaneously when multiple are provided', () => {
    renderDrawer(
      makeMetadata({
        judgeQualityWarnings: [
          { condition: 'singleProvider', severity: 'high' },
          { condition: 'lowestTierOnly', severity: 'medium' },
          { condition: 'juryDuplicates', severity: 'low' },
        ],
      }),
    )
    const content = screen.getByTestId('judge-quality-warnings').textContent ?? ''
    expect(content).toMatch(/Single provider configured/i)
    expect(content).toMatch(/Only lowest-tier models/i)
    expect(content).toMatch(/Jury size exceeds/i)
  })
})
