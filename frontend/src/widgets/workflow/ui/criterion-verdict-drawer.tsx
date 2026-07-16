import type { JudgeQualityWarning, ReliabilityMetadata } from '@shared/base-types'
import {
  GlassSheet,
  GlassSheetContent,
  GlassSheetHeader,
  GlassSheetTitle,
  GlassSheetDescription,
} from '@shared/ui/glass-sheet'
import { FormattedMessage } from 'react-intl'

const SEVERITY_I18N_KEY: Record<JudgeQualityWarning['severity'], string> = {
  high: 'workflowTree.verdictDrawer.judgeQualitySeverityHigh',
  medium: 'workflowTree.verdictDrawer.judgeQualitySeverityMedium',
  low: 'workflowTree.verdictDrawer.judgeQualitySeverityLow',
}

const CONDITION_I18N_KEY: Record<JudgeQualityWarning['condition'], string> = {
  singleProvider: 'workflowTree.verdictDrawer.judgeQualityWarning_singleProvider',
  lowestTierOnly: 'workflowTree.verdictDrawer.judgeQualityWarning_lowestTierOnly',
  juryDuplicates: 'workflowTree.verdictDrawer.judgeQualityWarning_juryDuplicates',
  fallbackWithWeakJudge: 'workflowTree.verdictDrawer.judgeQualityWarning_fallbackWithWeakJudge',
  noReasoningMode: 'workflowTree.verdictDrawer.judgeQualityWarning_noReasoningMode',
  allGateFiltered: 'workflowTree.verdictDrawer.judgeQualityWarning_allGateFiltered',
  degradedInput: 'workflowTree.verdictDrawer.judgeQualityWarning_degradedInput',
  commodityPartialSuccess: 'workflowTree.verdictDrawer.judgeQualityWarning_commodityPartialSuccess',
}

const MODE_I18N_KEY: Record<ReliabilityMetadata['mode'], string> = {
  strict: 'workflowTree.verdictDrawer.modeStrict',
  fallback: 'workflowTree.verdictDrawer.modeFallback',
  commodity: 'workflowTree.verdictDrawer.modeCommodity',
  invalid: 'workflowTree.verdictDrawer.modeInvalid',
  suppressed: 'workflowTree.verdictDrawer.modeSuppressed',
}

const INVALID_FAILURE_CAUSE_I18N_KEY: Record<string, string> = {
  'missing-parent': 'workflowTree.verdictDrawer.failureCauseMissingParent',
  'invalid-criteria': 'workflowTree.verdictDrawer.failureCauseInvalidCriteria',
}

const winnerRankForCriterion = (
  forkRankings: ReliabilityMetadata['perCriterionVerdict'][number]['forkRankings'],
  winnerForkIndex: number | null,
) => (winnerForkIndex === null ? undefined : forkRankings.find(({ forkIndex }) => forkIndex === winnerForkIndex)?.rank)

interface CriterionVerdictDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metadata: ReliabilityMetadata
}

export const CriterionVerdictDrawer = ({ open, onOpenChange, metadata }: CriterionVerdictDrawerProps) => {
  const {
    perCriterionVerdict,
    mode,
    eligible,
    total,
    noSignal,
    tiebreakUsed,
    fallbackUsed,
    generatorOnlyJudge,
    judgeReasoningRequested,
    winnerForkIndex,
    judgeQualityWarnings,
    failureCause,
  } = metadata

  return (
    <GlassSheet onOpenChange={onOpenChange} open={open}>
      <GlassSheetContent data-testid="criterion-verdict-drawer" side="right">
        <GlassSheetHeader>
          <GlassSheetTitle>
            <FormattedMessage id="workflowTree.verdictDrawer.title" />
          </GlassSheetTitle>
          <GlassSheetDescription className="sr-only">
            <FormattedMessage id="workflowTree.verdictDrawer.title" />
          </GlassSheetDescription>
          <div className="space-y-1 text-xs text-muted-foreground mt-1">
            <div>
              <FormattedMessage
                id="workflowTree.verdictDrawer.modeLabel"
                values={{
                  mode: <FormattedMessage id={MODE_I18N_KEY[mode]} />,
                }}
              />
            </div>
            {mode !== 'invalid' ? (
              <div>
                {mode === 'commodity' ? (
                  <FormattedMessage id="workflowTree.verdictDrawer.commodityLabel" values={{ eligible, total }} />
                ) : (
                  <FormattedMessage id="workflowTree.verdictDrawer.eligibleLabel" values={{ eligible, total }} />
                )}
              </div>
            ) : null}
            {winnerForkIndex === null && mode !== 'commodity' && mode !== 'invalid' ? (
              <div className="font-medium text-accent">
                <FormattedMessage id="workflowTree.verdictDrawer.noWinnerLabel" />
              </div>
            ) : null}
            {mode === 'commodity' && eligible > 0 && eligible < total ? (
              <div className="font-medium text-accent">
                <FormattedMessage
                  id="workflowTree.verdictDrawer.commodityPartialWarning"
                  values={{ eligible, total, failed: total - eligible }}
                />
              </div>
            ) : null}
            {mode === 'commodity' && eligible === 0 && total > 0 ? (
              <div className="rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-1.5 font-medium text-destructive">
                <FormattedMessage id="workflowTree.verdictDrawer.commodityAllFailedWarning" values={{ total }} />
              </div>
            ) : null}
            {mode === 'invalid' && failureCause && INVALID_FAILURE_CAUSE_I18N_KEY[failureCause] ? (
              <div className="rounded-sm border border-destructive/40 bg-destructive/5 px-3 py-1.5 font-medium text-destructive">
                <FormattedMessage id={INVALID_FAILURE_CAUSE_I18N_KEY[failureCause]} />
              </div>
            ) : null}
            {fallbackUsed ? (
              <div className="font-medium text-accent">
                <FormattedMessage id="workflowTree.verdictDrawer.fallbackUsedLabel" />
              </div>
            ) : null}
            {generatorOnlyJudge ? (
              <div className="font-medium text-accent">
                <FormattedMessage id="workflowTree.verdictDrawer.generatorOnlyJudgeLabel" />
              </div>
            ) : null}
            {judgeReasoningRequested ? (
              <div className="text-muted-foreground">
                <FormattedMessage id="workflowTree.verdictDrawer.judgeReasoningRequestedLabel" />
              </div>
            ) : null}
            {noSignal ? (
              <div className="font-medium text-accent">
                <FormattedMessage id="workflowTree.verdictDrawer.noSignalWarning" />
              </div>
            ) : null}
            {tiebreakUsed && !noSignal ? (
              <div className="font-medium text-accent">
                <FormattedMessage id="workflowTree.verdictDrawer.tiebreakWarning" />
              </div>
            ) : null}
          </div>
        </GlassSheetHeader>

        <div className="mt-4 space-y-4 overflow-y-auto px-6 pb-6">
          {judgeQualityWarnings && judgeQualityWarnings.length > 0 ? (
            <div
              className="rounded-md border border-accent/40 bg-accent/5 p-3 space-y-2"
              data-testid="judge-quality-warnings"
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <FormattedMessage id="workflowTree.verdictDrawer.judgeQualityWarningsTitle" />
              </span>
              <ul className="mt-1 space-y-1">
                {judgeQualityWarnings.map(({ condition, severity }) => (
                  <li className="flex items-start gap-2 text-xs" key={condition}>
                    <span
                      className={
                        severity === 'high'
                          ? 'text-destructive font-semibold shrink-0'
                          : severity === 'medium'
                            ? 'text-accent font-medium shrink-0'
                            : 'text-muted-foreground shrink-0'
                      }
                    >
                      <FormattedMessage id={SEVERITY_I18N_KEY[severity]} />:
                    </span>
                    <span>
                      <FormattedMessage id={CONDITION_I18N_KEY[condition]} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {perCriterionVerdict.map(({ criterionId, criterion, forkRankings }) => {
            const winnerRank = winnerRankForCriterion(forkRankings, winnerForkIndex)

            return (
              <div className="rounded-md border p-3 space-y-2" key={criterionId}>
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <FormattedMessage id="workflowTree.verdictDrawer.criterionLabel" />
                  </span>
                  <p className="text-sm mt-0.5">{criterion}</p>
                </div>

                {winnerRank ? (
                  <div className="rounded-sm border px-2 py-1 text-xs text-muted-foreground">
                    <FormattedMessage
                      id="workflowTree.verdictDrawer.winnerEvidenceLabel"
                      values={{
                        rank: winnerRank,
                        total: forkRankings.length,
                      }}
                    />
                  </div>
                ) : null}

                {forkRankings.length > 0 ? (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <FormattedMessage id="workflowTree.verdictDrawer.rankingsLabel" />
                    </span>
                    <ol className="mt-1 space-y-0.5">
                      {forkRankings.map(({ forkIndex, rank }) => (
                        <li className="flex items-center gap-2 text-sm" key={forkIndex}>
                          <span className="text-muted-foreground tabular-nums font-mono w-6">
                            <FormattedMessage id="workflowTree.verdictDrawer.rankLabel" values={{ rank }} />
                          </span>
                          <span className={forkIndex === winnerForkIndex ? 'font-semibold text-success' : ''}>
                            <FormattedMessage
                              id="workflowTree.verdictDrawer.forkLabel"
                              values={{ index: forkIndex + 1 }}
                            />
                            {forkIndex === winnerForkIndex ? (
                              <span className="ml-1 text-xs font-medium text-success">
                                <FormattedMessage id="workflowTree.verdictDrawer.winnerLabel" />
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </GlassSheetContent>
    </GlassSheet>
  )
}
