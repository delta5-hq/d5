package models

// RefineMode distinguishes best-of-N strict execution from lenient fallback execution and commodity parallel execution.
type RefineMode string

const (
	RefineModeStrict     RefineMode = "strict"
	RefineModeBackFall   RefineMode = "fallback"
	RefineModeCommodity  RefineMode = "commodity"
	RefineModeInvalid    RefineMode = "invalid"
	RefineModeSuppressed RefineMode = "suppressed"
)

// SelectionLayer records whether the winner came from the eligible primary pool or the fallback pool.
type SelectionLayer string

const (
	SelectionLayerPrimary  SelectionLayer = "primary"
	SelectionLayerFallback SelectionLayer = "fallback"
	SelectionLayerNone     SelectionLayer = "none"
)

// JudgeSeverity classifies the impact of a judge quality warning on selection reliability.
type JudgeSeverity string

const (
	JudgeSeverityHigh   JudgeSeverity = "high"
	JudgeSeverityMedium JudgeSeverity = "medium"
	JudgeSeverityLow    JudgeSeverity = "low"
)

// JudgeWarningCondition identifies which structural condition degraded the judge's reliability.
type JudgeWarningCondition string

const (
	JudgeWarnSingleProvider          JudgeWarningCondition = "singleProvider"
	JudgeWarnLowestTierOnly          JudgeWarningCondition = "lowestTierOnly"
	JudgeWarnJuryDuplicates          JudgeWarningCondition = "juryDuplicates"
	JudgeWarnFallbackWeakJudge       JudgeWarningCondition = "fallbackWithWeakJudge"
	JudgeWarnNoReasoningMode         JudgeWarningCondition = "noReasoningMode"
	JudgeWarnAllGateFiltered         JudgeWarningCondition = "allGateFiltered"
	JudgeWarnDegradedInput           JudgeWarningCondition = "degradedInput"
	JudgeWarnCommodityPartialSuccess JudgeWarningCondition = "commodityPartialSuccess"
)

type ReliabilityFailureCause string

const (
	ReliabilityFailureStructuralGate  ReliabilityFailureCause = "structural-gate"
	ReliabilityFailureCriteriaFailed  ReliabilityFailureCause = "criteria-failed"
	ReliabilityFailureRuntimeFailed   ReliabilityFailureCause = "runtime-failed"
	ReliabilityFailureNoEligibleForks ReliabilityFailureCause = "no-eligible-forks"
	ReliabilityFailureNoJudgeSignal   ReliabilityFailureCause = "no-judge-signal"
	ReliabilityFailureMissingParent   ReliabilityFailureCause = "missing-parent"
	ReliabilityFailureInvalidCriteria ReliabilityFailureCause = "invalid-criteria"
)

type ReliabilityRemediationHint string

const (
	ReliabilityRemediationRevisePrompt   ReliabilityRemediationHint = "revise-prompt"
	ReliabilityRemediationCheckProvider  ReliabilityRemediationHint = "check-provider"
	ReliabilityRemediationAdjustCriteria ReliabilityRemediationHint = "adjust-criteria"
	ReliabilityRemediationNone           ReliabilityRemediationHint = "none"
)

// ForkStatus identifies how a fork exited during best-of-N selection.
// Mirrors the three outcomes the Node.js engine can write to a ForkResult.
type ForkStatus string

const (
	ForkStatusOK             ForkStatus = "ok"
	ForkStatusCriteriaFailed ForkStatus = "criteria-failed"
	ForkStatusRuntimeFailed  ForkStatus = "runtime-failed"
)

// DiscardedFork captures the outcome of one non-winning fork for verdict-drawer display.
// ForkIndex and Status have no omitempty because fork 0 is a valid loser and status is always
// present. FailedAt, Reason, and Attempts are role-specific and omitempty. Attempts is *int so
// an explicit zero survives serialisation distinct from an absent field.
type DiscardedFork struct {
	ForkIndex int        `json:"forkIndex" bson:"forkIndex"`
	Status    ForkStatus `json:"status" bson:"status"`
	FailedAt  string     `json:"failedAt,omitempty" bson:"failedAt,omitempty"`
	Reason    string     `json:"reason,omitempty" bson:"reason,omitempty"`
	Attempts  *int       `json:"attempts,omitempty" bson:"attempts,omitempty"`
}

// ForkRanking records one fork's ordinal rank as assigned by one criterion's jury.
type ForkRanking struct {
	ForkIndex int `json:"forkIndex" bson:"forkIndex"`
	Rank      int `json:"rank" bson:"rank"`
}

// CriterionVerdict holds the jury's per-criterion fork rankings for a single /validate criterion.
type CriterionVerdict struct {
	CriterionID  string        `json:"criterionId" bson:"criterionId"`
	Criterion    string        `json:"criterion" bson:"criterion"`
	ForkRankings []ForkRanking `json:"forkRankings" bson:"forkRankings"`
}

// JudgeQualityWarning flags a condition that raises the judge's effective false-acceptance rate beta.
type JudgeQualityWarning struct {
	Condition JudgeWarningCondition `json:"condition" bson:"condition"`
	Severity  JudgeSeverity         `json:"severity" bson:"severity"`
}

// JudgeInputMetadata records what the judge actually received, enabling reproducible verdict-drawer diagnostics.
type JudgeInputMetadata struct {
	CandidateCount        int      `json:"candidateCount" bson:"candidateCount"`
	PerForkBudgetChars    int      `json:"perForkBudgetChars" bson:"perForkBudgetChars"`
	DegradedInput         bool     `json:"degradedInput" bson:"degradedInput"`
	ResolvedJudgeFamilies []string `json:"resolvedJudgeFamilies" bson:"resolvedJudgeFamilies"`
}

// ReliabilityMetadata persists the judge's complete verdict for a /refine cell across page reloads.
// Written by the Node.js execution engine after fork selection; consumed by the frontend verdict drawer.
// Attached to a Node as a pointer so nodes that have never run /refine carry no overhead.
type ReliabilityMetadata struct {
	WinnerForkIndex         *int                       `json:"winnerForkIndex" bson:"winnerForkIndex"`
	PerCriterionVerdict     []CriterionVerdict         `json:"perCriterionVerdict" bson:"perCriterionVerdict"`
	Mode                    RefineMode                 `json:"mode" bson:"mode"`
	SelectionLayer          SelectionLayer             `json:"selectionLayer" bson:"selectionLayer"`
	FallbackUsed            bool                       `json:"fallbackUsed,omitempty" bson:"fallbackUsed,omitempty"`
	GeneratorOnlyJudge      bool                       `json:"generatorOnlyJudge,omitempty" bson:"generatorOnlyJudge,omitempty"`
	JudgeReasoningRequested bool                       `json:"judgeReasoningRequested,omitempty" bson:"judgeReasoningRequested,omitempty"`
	NoSignal                bool                       `json:"noSignal" bson:"noSignal"`
	TiebreakUsed            *bool                      `json:"tiebreakUsed,omitempty" bson:"tiebreakUsed,omitempty"`
	Eligible                int                        `json:"eligible" bson:"eligible"`
	Total                   int                        `json:"total" bson:"total"`
	Suppressed              bool                       `json:"suppressed,omitempty" bson:"suppressed,omitempty"`
	Cause                   string                     `json:"cause,omitempty" bson:"cause,omitempty"`
	RequestedN              int                        `json:"requestedN,omitempty" bson:"requestedN,omitempty"`
	RetryWithheld           bool                       `json:"retryWithheld,omitempty" bson:"retryWithheld,omitempty"`
	RequestedRetry          int                        `json:"requestedRetry,omitempty" bson:"requestedRetry,omitempty"`
	JudgeInput              *JudgeInputMetadata        `json:"judgeInput,omitempty" bson:"judgeInput,omitempty"`
	JudgeQualityWarnings    []JudgeQualityWarning      `json:"judgeQualityWarnings,omitempty" bson:"judgeQualityWarnings,omitempty"`
	FailureCause            ReliabilityFailureCause    `json:"failureCause,omitempty" bson:"failureCause,omitempty"`
	RemediationHint         ReliabilityRemediationHint `json:"remediationHint,omitempty" bson:"remediationHint,omitempty"`
	AllGateFiltered         *bool                      `json:"allGateFiltered,omitempty" bson:"allGateFiltered,omitempty"`
	DiscardedForks          []DiscardedFork            `json:"discardedForks,omitempty" bson:"discardedForks,omitempty"`
}
