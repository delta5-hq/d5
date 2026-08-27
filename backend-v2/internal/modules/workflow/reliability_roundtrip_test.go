package workflow

import (
	"backend-v2/internal/models"
	"encoding/json"
	"testing"
)

func boolPtr(v bool) *bool { return &v }

func minimalReliabilityMetadata() models.ReliabilityMetadata {
	return models.ReliabilityMetadata{
		WinnerForkIndex:     intPtr(0),
		PerCriterionVerdict: []models.CriterionVerdict{},
		Mode:                models.ElectModeStrict,
		SelectionLayer:      models.SelectionLayerPrimary,
		NoSignal:            false,
		Eligible:            1,
		Total:               2,
	}
}

func unmarshalNodeRoundTrip(t *testing.T, node models.Node) models.Node {
	t.Helper()
	data, err := json.Marshal(node)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	var restored models.Node
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	return restored
}

// key-presence assertions need raw bytes; typed unmarshaling normalizes absent-vs-zero.
func extractRawFields(t *testing.T, node models.Node) map[string]json.RawMessage {
	t.Helper()
	data, err := json.Marshal(node)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	var nodeRaw map[string]json.RawMessage
	if err := json.Unmarshal(data, &nodeRaw); err != nil {
		t.Fatalf("unmarshal node failed: %v", err)
	}
	rmBytes, present := nodeRaw["reliabilityMetadata"]
	if !present {
		t.Fatal("reliabilityMetadata not present in JSON — node has nil metadata or omitempty removed it")
	}
	var rmRaw map[string]json.RawMessage
	if err := json.Unmarshal(rmBytes, &rmRaw); err != nil {
		t.Fatalf("unmarshal reliabilityMetadata failed: %v", err)
	}
	return rmRaw
}

func TestNode_ExecutionStatus_RoundTrip(t *testing.T) {
	restored := unmarshalNodeRoundTrip(t, models.Node{ID: "n", ExecutionStatus: models.ExecutionStatusError})
	if restored.ExecutionStatus != models.ExecutionStatusError {
		t.Fatalf("executionStatus did not survive JSON round-trip: got %q", restored.ExecutionStatus)
	}
}

func TestNode_ExecutionFailureSignal_RoundTrip(t *testing.T) {
	restored := unmarshalNodeRoundTrip(t, models.Node{
		ID:                   "n",
		ExecutionStatus:      models.ExecutionStatusError,
		ExecutionFailureType: models.ExecutionFailureHTTPStatus,
		ExecutionFailureCode: 503,
	})
	if restored.ExecutionFailureType != models.ExecutionFailureHTTPStatus {
		t.Fatalf("executionFailureType did not survive JSON round-trip: got %q", restored.ExecutionFailureType)
	}
	if restored.ExecutionFailureCode != 503 {
		t.Fatalf("executionFailureCode did not survive JSON round-trip: got %d", restored.ExecutionFailureCode)
	}
}

// omitempty applies to the pointer itself — a non-nil pointer with zero-value fields still produces JSON keys.
func TestNode_ReliabilityMetadata_Presence(t *testing.T) {
	tests := []struct {
		name        string
		metadata    *models.ReliabilityMetadata
		wantPresent bool
		description string
	}{
		{
			name:        "nil metadata omitted",
			metadata:    nil,
			wantPresent: false,
			description: "reliabilityMetadata key must be absent from JSON when the pointer is nil",
		},
		{
			name:        "zero-value metadata present",
			metadata:    &models.ReliabilityMetadata{},
			wantPresent: true,
			description: "reliabilityMetadata key must appear even when all fields are zero values",
		},
		{
			name: "populated metadata present",
			metadata: func() *models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				return &m
			}(),
			wantPresent: true,
			description: "reliabilityMetadata key must appear when the pointer is non-nil",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := models.Node{ID: "n", ReliabilityMetadata: tt.metadata}
			data, err := json.Marshal(node)
			if err != nil {
				t.Fatalf("marshal failed: %v", err)
			}
			var raw map[string]json.RawMessage
			if err := json.Unmarshal(data, &raw); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}
			_, present := raw["reliabilityMetadata"]
			if present != tt.wantPresent {
				t.Errorf("%s: present=%v, want %v", tt.description, present, tt.wantPresent)
			}
		})
	}
}

// Go zero values (0, false, "", []) must not be silently dropped — json omitempty on optional fields must not bleed onto required ones.
func TestReliabilityMetadata_RequiredFields_RoundTrip(t *testing.T) {
	tests := []struct {
		name        string
		metadata    models.ReliabilityMetadata
		description string
	}{
		{
			name: "winner is fork 0 (zero value must not be omitted)",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: intPtr(0),
				Mode:            models.ElectModeStrict,
				SelectionLayer:  models.SelectionLayerPrimary,
				Eligible:        1,
				Total:           1,
			},
			description: "WinnerForkIndex=0 must survive — fork 0 is a valid winner, not a missing value",
		},
		{
			name: "no-signal path with zero eligible and total",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: intPtr(0),
				Mode:            models.ElectModeStrict,
				SelectionLayer:  models.SelectionLayerPrimary,
				NoSignal:        true,
				Eligible:        0,
				Total:           0,
			},
			description: "NoSignal=true with Eligible=0 and Total=0 must all round-trip",
		},
		{
			name: "empty criterion list preserves slice identity",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex:     intPtr(1),
				PerCriterionVerdict: []models.CriterionVerdict{},
				Mode:                models.ElectModeStrict,
				SelectionLayer:      models.SelectionLayerPrimary,
				Eligible:            2,
				Total:               3,
			},
			description: "empty PerCriterionVerdict slice must round-trip as an empty array, not null",
		},
		{
			name: "multiple criteria with multiple fork rankings",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: intPtr(2),
				PerCriterionVerdict: []models.CriterionVerdict{
					{
						CriterionID:  "c1",
						Criterion:    "must mention revenue",
						ForkRankings: []models.ForkRanking{{ForkIndex: 0, Rank: 2}, {ForkIndex: 2, Rank: 1}},
					},
					{
						CriterionID:  "c2",
						Criterion:    "must cite company names",
						ForkRankings: []models.ForkRanking{{ForkIndex: 0, Rank: 1}, {ForkIndex: 2, Rank: 2}},
					},
				},
				Mode:           models.ElectModeStrict,
				SelectionLayer: models.SelectionLayerPrimary,
				Eligible:       3,
				Total:          3,
			},
			description: "multiple criteria and non-sequential fork indices must all survive",
		},
		{
			name: "strict mode with primary selection layer",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: intPtr(1),
				Mode:            models.ElectModeStrict,
				SelectionLayer:  models.SelectionLayerPrimary,
				Eligible:        2,
				Total:           3,
			},
			description: "strict+primary combination must round-trip correctly",
		},
		{
			name: "fallback mode with fallback selection layer",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: intPtr(0),
				Mode:            models.ElectModeBackFall,
				SelectionLayer:  models.SelectionLayerFallback,
				Eligible:        0,
				Total:           2,
			},
			description: "fallback+fallback combination must round-trip correctly",
		},
		{
			name: "allGateFiltered path: selectionLayer none with null winner",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex:     nil,
				PerCriterionVerdict: []models.CriterionVerdict{},
				Mode:                models.ElectModeStrict,
				SelectionLayer:      models.SelectionLayerNone,
				AllGateFiltered:     boolPtr(true),
				Eligible:            0,
				Total:               2,
			},
			description: "SelectionLayerNone with null winner must round-trip — allGateFiltered path",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := models.Node{ID: "n", ReliabilityMetadata: &tt.metadata}
			restored := unmarshalNodeRoundTrip(t, node)

			rm := restored.ReliabilityMetadata
			if rm == nil {
				t.Fatal("reliabilityMetadata must be non-nil after round-trip")
			}
			orig := &tt.metadata
			if !winnerForkIndexEqual(rm.WinnerForkIndex, orig.WinnerForkIndex) {
				t.Errorf("%s: WinnerForkIndex mismatch: want %v, got %v", tt.description, orig.WinnerForkIndex, rm.WinnerForkIndex)
			}
			if rm.Mode != orig.Mode {
				t.Errorf("%s: Mode want %q, got %q", tt.description, orig.Mode, rm.Mode)
			}
			if rm.SelectionLayer != orig.SelectionLayer {
				t.Errorf("%s: SelectionLayer want %q, got %q", tt.description, orig.SelectionLayer, rm.SelectionLayer)
			}
			if rm.NoSignal != orig.NoSignal {
				t.Errorf("%s: NoSignal want %v, got %v", tt.description, orig.NoSignal, rm.NoSignal)
			}
			if rm.Eligible != orig.Eligible {
				t.Errorf("%s: Eligible want %d, got %d", tt.description, orig.Eligible, rm.Eligible)
			}
			if rm.Total != orig.Total {
				t.Errorf("%s: Total want %d, got %d", tt.description, orig.Total, rm.Total)
			}
			if len(rm.PerCriterionVerdict) != len(orig.PerCriterionVerdict) {
				t.Fatalf("%s: PerCriterionVerdict length want %d, got %d",
					tt.description, len(orig.PerCriterionVerdict), len(rm.PerCriterionVerdict))
			}
			for i, cv := range orig.PerCriterionVerdict {
				if rm.PerCriterionVerdict[i].CriterionID != cv.CriterionID {
					t.Errorf("%s: criterion[%d].CriterionID want %q, got %q",
						tt.description, i, cv.CriterionID, rm.PerCriterionVerdict[i].CriterionID)
				}
				if len(rm.PerCriterionVerdict[i].ForkRankings) != len(cv.ForkRankings) {
					t.Errorf("%s: criterion[%d] ForkRankings length want %d, got %d",
						tt.description, i, len(cv.ForkRankings), len(rm.PerCriterionVerdict[i].ForkRankings))
				}
			}
		})
	}
}

// Frontend expects key absence, not null/""/[] — the field must not appear at all when unset.
func TestReliabilityMetadata_OptionalFields_OmittedWhenAbsent(t *testing.T) {
	tests := []struct {
		name         string
		metadata     models.ReliabilityMetadata
		absentFields []string
		description  string
	}{
		{
			name:         "nil TiebreakUsed, nil JudgeInput, nil JudgeQualityWarnings",
			metadata:     minimalReliabilityMetadata(),
			absentFields: []string{"tiebreakUsed", "judgeInput", "judgeQualityWarnings"},
			description:  "all three optional fields must be absent when nil",
		},
		{
			name: "empty JudgeQualityWarnings slice omitted",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex:      intPtr(0),
				Mode:                 models.ElectModeStrict,
				SelectionLayer:       models.SelectionLayerPrimary,
				Eligible:             1,
				Total:                1,
				JudgeQualityWarnings: []models.JudgeQualityWarning{},
			},
			absentFields: []string{"judgeQualityWarnings"},
			description:  "empty JudgeQualityWarnings slice must be omitted (same as nil)",
		},
		{
			name: "TiebreakUsed nil while others set",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: intPtr(1),
				Mode:            models.ElectModeStrict,
				SelectionLayer:  models.SelectionLayerPrimary,
				Eligible:        2,
				Total:           2,
				JudgeInput: &models.JudgeInputMetadata{
					CandidateCount:        2,
					PerForkBudgetChars:    4000,
					DegradedInput:         false,
					ResolvedJudgeFamilies: []string{"openai"},
				},
			},
			absentFields: []string{"tiebreakUsed"},
			description:  "TiebreakUsed must be absent even when JudgeInput is set",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := models.Node{ID: "n", ReliabilityMetadata: &tt.metadata}
			rmRaw := extractRawFields(t, node)
			for _, field := range tt.absentFields {
				if _, present := rmRaw[field]; present {
					t.Errorf("%s: field %q must be absent, but was present in JSON", tt.description, field)
				}
			}
		})
	}
}

func TestReliabilityMetadata_OptionalFields_PreservedWhenSet(t *testing.T) {
	tests := []struct {
		name        string
		metadata    models.ReliabilityMetadata
		verify      func(t *testing.T, rm *models.ReliabilityMetadata)
		description string
	}{
		{
			name: "TiebreakUsed true round-trips",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.TiebreakUsed = boolPtr(true)
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				if rm.TiebreakUsed == nil {
					t.Fatal("TiebreakUsed must be non-nil")
				}
				if *rm.TiebreakUsed != true {
					t.Errorf("TiebreakUsed want true, got %v", *rm.TiebreakUsed)
				}
			},
			description: "TiebreakUsed=true must be preserved exactly",
		},
		{
			name: "TiebreakUsed false round-trips",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.TiebreakUsed = boolPtr(false)
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				if rm.TiebreakUsed == nil {
					t.Fatal("TiebreakUsed must be non-nil — false is a meaningful value, not absence")
				}
				if *rm.TiebreakUsed != false {
					t.Errorf("TiebreakUsed want false, got %v", *rm.TiebreakUsed)
				}
			},
			description: "TiebreakUsed=false must be preserved — false differs from absent",
		},
		{
			name: "JudgeInput all fields round-trip",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.JudgeInput = &models.JudgeInputMetadata{
					CandidateCount:        5,
					PerForkBudgetChars:    8000,
					DegradedInput:         true,
					ResolvedJudgeFamilies: []string{"openai", "claude", "deepseek"},
				}
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				ji := rm.JudgeInput
				if ji == nil {
					t.Fatal("JudgeInput must be non-nil")
				}
				if ji.CandidateCount != 5 {
					t.Errorf("CandidateCount want 5, got %d", ji.CandidateCount)
				}
				if ji.PerForkBudgetChars != 8000 {
					t.Errorf("PerForkBudgetChars want 8000, got %d", ji.PerForkBudgetChars)
				}
				if !ji.DegradedInput {
					t.Error("DegradedInput want true, got false")
				}
				if len(ji.ResolvedJudgeFamilies) != 3 {
					t.Errorf("ResolvedJudgeFamilies length want 3, got %d", len(ji.ResolvedJudgeFamilies))
				}
			},
			description: "all JudgeInputMetadata fields must survive round-trip",
		},
		{
			name: "JudgeInput with empty ResolvedJudgeFamilies",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.JudgeInput = &models.JudgeInputMetadata{
					CandidateCount:        2,
					PerForkBudgetChars:    2000,
					DegradedInput:         false,
					ResolvedJudgeFamilies: []string{},
				}
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				if rm.JudgeInput == nil {
					t.Fatal("JudgeInput must be non-nil")
				}
				if rm.JudgeInput.ResolvedJudgeFamilies == nil {
					t.Error("ResolvedJudgeFamilies must not be nil after round-trip — empty slice must be preserved")
				}
			},
			description: "JudgeInput with empty ResolvedJudgeFamilies must survive round-trip",
		},
		{
			name: "multiple JudgeQualityWarnings round-trip",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.JudgeQualityWarnings = []models.JudgeQualityWarning{
					{Condition: models.JudgeWarnSingleProvider, Severity: models.JudgeSeverityHigh},
					{Condition: models.JudgeWarnJuryDuplicates, Severity: models.JudgeSeverityMedium},
					{Condition: models.JudgeWarnNoReasoningMode, Severity: models.JudgeSeverityLow},
				}
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				if len(rm.JudgeQualityWarnings) != 3 {
					t.Fatalf("JudgeQualityWarnings length want 3, got %d", len(rm.JudgeQualityWarnings))
				}
				if rm.JudgeQualityWarnings[0].Condition != models.JudgeWarnSingleProvider {
					t.Errorf("warning[0].Condition want %q, got %q", models.JudgeWarnSingleProvider, rm.JudgeQualityWarnings[0].Condition)
				}
				if rm.JudgeQualityWarnings[2].Severity != models.JudgeSeverityLow {
					t.Errorf("warning[2].Severity want %q, got %q", models.JudgeSeverityLow, rm.JudgeQualityWarnings[2].Severity)
				}
			},
			description: "multiple warnings with distinct conditions and severities must all survive",
		},
		{
			name: "failure semantics round-trip",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.FailureCause = models.ReliabilityFailureStructuralGate
				m.RemediationHint = models.ReliabilityRemediationRevisePrompt
				m.AllGateFiltered = boolPtr(true)
				m.JudgeQualityWarnings = []models.JudgeQualityWarning{
					{Condition: models.JudgeWarnAllGateFiltered, Severity: models.JudgeSeverityHigh},
				}
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				if rm.FailureCause != models.ReliabilityFailureStructuralGate {
					t.Errorf("FailureCause want %q, got %q", models.ReliabilityFailureStructuralGate, rm.FailureCause)
				}
				if rm.RemediationHint != models.ReliabilityRemediationRevisePrompt {
					t.Errorf("RemediationHint want %q, got %q", models.ReliabilityRemediationRevisePrompt, rm.RemediationHint)
				}
				if rm.AllGateFiltered == nil || *rm.AllGateFiltered != true {
					t.Fatalf("AllGateFiltered must round-trip as explicit true, got %#v", rm.AllGateFiltered)
				}
				if len(rm.JudgeQualityWarnings) != 1 || rm.JudgeQualityWarnings[0].Condition != models.JudgeWarnAllGateFiltered {
					t.Fatalf("JudgeWarnAllGateFiltered must round-trip, got %#v", rm.JudgeQualityWarnings)
				}
			},
			description: "failure cause, remediation hint, structural flag, and structural warning must survive round-trip",
		},
		{
			name: "degradedInput JudgeQualityWarning round-trip",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.JudgeQualityWarnings = []models.JudgeQualityWarning{
					{Condition: models.JudgeWarnDegradedInput, Severity: models.JudgeSeverityMedium},
				}
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				if len(rm.JudgeQualityWarnings) != 1 {
					t.Fatalf("JudgeQualityWarnings length want 1, got %d", len(rm.JudgeQualityWarnings))
				}
				if rm.JudgeQualityWarnings[0].Condition != models.JudgeWarnDegradedInput {
					t.Errorf("Condition want %q, got %q", models.JudgeWarnDegradedInput, rm.JudgeQualityWarnings[0].Condition)
				}
				if rm.JudgeQualityWarnings[0].Severity != models.JudgeSeverityMedium {
					t.Errorf("Severity want %q, got %q", models.JudgeSeverityMedium, rm.JudgeQualityWarnings[0].Severity)
				}
			},
			description: "degradedInput warning condition and severity must survive round-trip",
		},
		{
			name: "all JudgeWarningCondition values round-trip without data loss",
			metadata: func() models.ReliabilityMetadata {
				m := minimalReliabilityMetadata()
				m.JudgeQualityWarnings = []models.JudgeQualityWarning{
					{Condition: models.JudgeWarnSingleProvider, Severity: models.JudgeSeverityHigh},
					{Condition: models.JudgeWarnLowestTierOnly, Severity: models.JudgeSeverityMedium},
					{Condition: models.JudgeWarnJuryDuplicates, Severity: models.JudgeSeverityMedium},
					{Condition: models.JudgeWarnFallbackWeakJudge, Severity: models.JudgeSeverityHigh},
					{Condition: models.JudgeWarnNoReasoningMode, Severity: models.JudgeSeverityMedium},
					{Condition: models.JudgeWarnAllGateFiltered, Severity: models.JudgeSeverityHigh},
					{Condition: models.JudgeWarnDegradedInput, Severity: models.JudgeSeverityMedium},
					{Condition: models.JudgeWarnCommodityPartialSuccess, Severity: models.JudgeSeverityMedium},
				}
				return m
			}(),
			verify: func(t *testing.T, rm *models.ReliabilityMetadata) {
				t.Helper()
				want := []models.JudgeWarningCondition{
					models.JudgeWarnSingleProvider,
					models.JudgeWarnLowestTierOnly,
					models.JudgeWarnJuryDuplicates,
					models.JudgeWarnFallbackWeakJudge,
					models.JudgeWarnNoReasoningMode,
					models.JudgeWarnAllGateFiltered,
					models.JudgeWarnDegradedInput,
					models.JudgeWarnCommodityPartialSuccess,
				}
				if len(rm.JudgeQualityWarnings) != len(want) {
					t.Fatalf("JudgeQualityWarnings length want %d, got %d", len(want), len(rm.JudgeQualityWarnings))
				}
				for i, wantCond := range want {
					if rm.JudgeQualityWarnings[i].Condition != wantCond {
						t.Errorf("warning[%d].Condition want %q, got %q", i, wantCond, rm.JudgeQualityWarnings[i].Condition)
					}
				}
			},
			description: "all eight warning conditions must survive a round-trip in order without any being dropped or mutated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := models.Node{ID: "n", ReliabilityMetadata: &tt.metadata}
			restored := unmarshalNodeRoundTrip(t, node)
			if restored.ReliabilityMetadata == nil {
				t.Fatal("reliabilityMetadata must be non-nil after round-trip")
			}
			tt.verify(t, restored.ReliabilityMetadata)
		})
	}
}

func TestJudgeWarningCondition_CanonicalSet(t *testing.T) {
	canonical := map[models.JudgeWarningCondition]string{
		models.JudgeWarnSingleProvider:          "singleProvider",
		models.JudgeWarnLowestTierOnly:          "lowestTierOnly",
		models.JudgeWarnJuryDuplicates:          "juryDuplicates",
		models.JudgeWarnFallbackWeakJudge:       "fallbackWithWeakJudge",
		models.JudgeWarnNoReasoningMode:         "noReasoningMode",
		models.JudgeWarnAllGateFiltered:         "allGateFiltered",
		models.JudgeWarnDegradedInput:           "degradedInput",
		models.JudgeWarnCommodityPartialSuccess: "commodityPartialSuccess",
	}

	for constVal, wantString := range canonical {
		t.Run(string(constVal), func(t *testing.T) {
			if string(constVal) != wantString {
				t.Errorf("JudgeWarningCondition const value: want %q, got %q", wantString, string(constVal))
			}
		})
	}

	t.Run("count", func(t *testing.T) {
		const wantCount = 8
		if len(canonical) != wantCount {
			t.Errorf("canonical set has %d conditions, want %d — update this test and failureSemantics.js when adding a new condition",
				len(canonical), wantCount)
		}
	})
}

// Enum constant drift silently breaks the frontend verdict drawer.
func TestReliabilityMetadata_EnumConstants_SerializeToCanonicalStrings(t *testing.T) {
	t.Run("ElectMode", func(t *testing.T) {
		tests := []struct {
			value    models.ElectMode
			wantJSON string
		}{
			{models.ElectModeStrict, `"strict"`},
			{models.ElectModeBackFall, `"fallback"`},
			{models.ElectModeCommodity, `"commodity"`},
			{models.ElectModeValidate, `"validate"`},
			{models.ElectModeRefine, `"refine"`},
			{models.ElectModeInvalid, `"invalid"`},
			{models.ElectModeSuppressed, `"suppressed"`},
		}
		for _, tt := range tests {
			t.Run(string(tt.value), func(t *testing.T) {
				got, err := json.Marshal(tt.value)
				if err != nil {
					t.Fatalf("marshal failed: %v", err)
				}
				if string(got) != tt.wantJSON {
					t.Errorf("ElectMode %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
				}
			})
		}
	})

	t.Run("SelectionLayer", func(t *testing.T) {
		tests := []struct {
			value    models.SelectionLayer
			wantJSON string
		}{
			{models.SelectionLayerPrimary, `"primary"`},
			{models.SelectionLayerFallback, `"fallback"`},
			{models.SelectionLayerNone, `"none"`},
		}
		for _, tt := range tests {
			t.Run(string(tt.value), func(t *testing.T) {
				got, err := json.Marshal(tt.value)
				if err != nil {
					t.Fatalf("marshal failed: %v", err)
				}
				if string(got) != tt.wantJSON {
					t.Errorf("SelectionLayer %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
				}
			})
		}
	})

	t.Run("JudgeSeverity", func(t *testing.T) {
		tests := []struct {
			value    models.JudgeSeverity
			wantJSON string
		}{
			{models.JudgeSeverityHigh, `"high"`},
			{models.JudgeSeverityMedium, `"medium"`},
			{models.JudgeSeverityLow, `"low"`},
		}
		for _, tt := range tests {
			t.Run(string(tt.value), func(t *testing.T) {
				got, err := json.Marshal(tt.value)
				if err != nil {
					t.Fatalf("marshal failed: %v", err)
				}
				if string(got) != tt.wantJSON {
					t.Errorf("JudgeSeverity %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
				}
			})
		}
	})

	t.Run("JudgeWarningCondition", func(t *testing.T) {
		tests := []struct {
			value    models.JudgeWarningCondition
			wantJSON string
		}{
			{models.JudgeWarnSingleProvider, `"singleProvider"`},
			{models.JudgeWarnLowestTierOnly, `"lowestTierOnly"`},
			{models.JudgeWarnJuryDuplicates, `"juryDuplicates"`},
			{models.JudgeWarnFallbackWeakJudge, `"fallbackWithWeakJudge"`},
			{models.JudgeWarnNoReasoningMode, `"noReasoningMode"`},
			{models.JudgeWarnAllGateFiltered, `"allGateFiltered"`},
			{models.JudgeWarnDegradedInput, `"degradedInput"`},
			{models.JudgeWarnCommodityPartialSuccess, `"commodityPartialSuccess"`},
		}
		for _, tt := range tests {
			t.Run(string(tt.value), func(t *testing.T) {
				got, err := json.Marshal(tt.value)
				if err != nil {
					t.Fatalf("marshal failed: %v", err)
				}
				if string(got) != tt.wantJSON {
					t.Errorf("JudgeWarningCondition %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
				}
			})
		}
	})

	t.Run("ReliabilityFailureCause", func(t *testing.T) {
		tests := []struct {
			value    models.ReliabilityFailureCause
			wantJSON string
		}{
			{models.ReliabilityFailureStructuralGate, `"structural-gate"`},
			{models.ReliabilityFailureCriteriaFailed, `"criteria-failed"`},
			{models.ReliabilityFailureRuntimeFailed, `"runtime-failed"`},
			{models.ReliabilityFailureNoEligibleForks, `"no-eligible-forks"`},
			{models.ReliabilityFailureNoJudgeSignal, `"no-judge-signal"`},
		}
		for _, tt := range tests {
			t.Run(string(tt.value), func(t *testing.T) {
				got, err := json.Marshal(tt.value)
				if err != nil {
					t.Fatalf("marshal failed: %v", err)
				}
				if string(got) != tt.wantJSON {
					t.Errorf("ReliabilityFailureCause %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
				}
			})
		}
	})

	t.Run("ReliabilityRemediationHint", func(t *testing.T) {
		tests := []struct {
			value    models.ReliabilityRemediationHint
			wantJSON string
		}{
			{models.ReliabilityRemediationRevisePrompt, `"revise-prompt"`},
			{models.ReliabilityRemediationCheckProvider, `"check-provider"`},
			{models.ReliabilityRemediationAdjustCriteria, `"adjust-criteria"`},
			{models.ReliabilityRemediationNone, `"none"`},
		}
		for _, tt := range tests {
			t.Run(string(tt.value), func(t *testing.T) {
				got, err := json.Marshal(tt.value)
				if err != nil {
					t.Fatalf("marshal failed: %v", err)
				}
				if string(got) != tt.wantJSON {
					t.Errorf("ReliabilityRemediationHint %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
				}
			})
		}
	})
}

// Go uses the struct tag for JSON keys, not the field name — renaming a field silently breaks the TypeScript contract until a browser session.
func TestReliabilityMetadata_JSONFieldNames(t *testing.T) {
	t.Run("ReliabilityMetadata top-level keys", func(t *testing.T) {
		tiebreak := true
		m := minimalReliabilityMetadata()
		m.TiebreakUsed = &tiebreak
		m.JudgeInput = &models.JudgeInputMetadata{
			CandidateCount:        2,
			PerForkBudgetChars:    1000,
			DegradedInput:         false,
			ResolvedJudgeFamilies: []string{"openai"},
		}
		m.JudgeQualityWarnings = []models.JudgeQualityWarning{
			{Condition: models.JudgeWarnSingleProvider, Severity: models.JudgeSeverityHigh},
		}
		m.FailureCause = models.ReliabilityFailureStructuralGate
		m.RemediationHint = models.ReliabilityRemediationRevisePrompt
		m.AllGateFiltered = boolPtr(true)
		m.DiscardedForks = []models.DiscardedFork{{ForkIndex: 1, Status: models.ForkStatusOK}}
		m.FallbackUsed = true
		m.GeneratorOnlyJudge = true
		m.JudgeReasoningRequested = true
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)

		requiredKeys := []string{
			"winnerForkIndex", "perCriterionVerdict", "mode", "selectionLayer",
			"noSignal", "eligible", "total",
		}
		for _, key := range requiredKeys {
			if _, present := rmRaw[key]; !present {
				t.Errorf("required JSON key %q must be present in reliabilityMetadata", key)
			}
		}

		optionalKeys := []string{
			"tiebreakUsed", "judgeInput", "judgeQualityWarnings", "discardedForks",
			"failureCause", "remediationHint", "allGateFiltered",
			"fallbackUsed", "generatorOnlyJudge", "judgeReasoningRequested",
		}
		for _, key := range optionalKeys {
			if _, present := rmRaw[key]; !present {
				t.Errorf("optional JSON key %q must be present when the field is set", key)
			}
		}
	})

	t.Run("JudgeInputMetadata keys", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.JudgeInput = &models.JudgeInputMetadata{
			CandidateCount:        3,
			PerForkBudgetChars:    5000,
			DegradedInput:         true,
			ResolvedJudgeFamilies: []string{"claude"},
		}
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)

		var jiRaw map[string]json.RawMessage
		if err := json.Unmarshal(rmRaw["judgeInput"], &jiRaw); err != nil {
			t.Fatalf("unmarshal judgeInput failed: %v", err)
		}
		for _, key := range []string{"candidateCount", "perForkBudgetChars", "degradedInput", "resolvedJudgeFamilies"} {
			if _, present := jiRaw[key]; !present {
				t.Errorf("required JSON key judgeInput.%q must be present", key)
			}
		}
	})

	t.Run("CriterionVerdict and ForkRanking keys", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.PerCriterionVerdict = []models.CriterionVerdict{
			{
				CriterionID:  "v1",
				Criterion:    "some criterion",
				ForkRankings: []models.ForkRanking{{ForkIndex: 0, Rank: 1}},
			},
		}
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)

		var pcv []json.RawMessage
		if err := json.Unmarshal(rmRaw["perCriterionVerdict"], &pcv); err != nil {
			t.Fatalf("unmarshal perCriterionVerdict failed: %v", err)
		}
		if len(pcv) == 0 {
			t.Fatal("perCriterionVerdict must have at least one entry")
		}
		var cvRaw map[string]json.RawMessage
		if err := json.Unmarshal(pcv[0], &cvRaw); err != nil {
			t.Fatalf("unmarshal criterionVerdict failed: %v", err)
		}
		for _, key := range []string{"criterionId", "criterion", "forkRankings"} {
			if _, present := cvRaw[key]; !present {
				t.Errorf("required JSON key CriterionVerdict.%q must be present", key)
			}
		}

		var rankings []json.RawMessage
		if err := json.Unmarshal(cvRaw["forkRankings"], &rankings); err != nil {
			t.Fatalf("unmarshal forkRankings failed: %v", err)
		}
		if len(rankings) == 0 {
			t.Fatal("forkRankings must have at least one entry")
		}
		var rankRaw map[string]json.RawMessage
		if err := json.Unmarshal(rankings[0], &rankRaw); err != nil {
			t.Fatalf("unmarshal forkRanking failed: %v", err)
		}
		for _, key := range []string{"forkIndex", "rank"} {
			if _, present := rankRaw[key]; !present {
				t.Errorf("required JSON key ForkRanking.%q must be present", key)
			}
		}
	})
}

// Nodes that never ran /elect must carry no metadata after round-trip.
func TestWorkflow_Nodes_ReliabilityMetadata_Isolation(t *testing.T) {
	tests := []struct {
		name        string
		nodes       map[string]models.Node
		wantMeta    map[string]bool // nodeID → true if should have metadata
		description string
	}{
		{
			name: "single node with metadata",
			nodes: map[string]models.Node{
				"elect": {ID: "elect", ReliabilityMetadata: func() *models.ReliabilityMetadata {
					m := minimalReliabilityMetadata()
					return &m
				}()},
			},
			wantMeta:    map[string]bool{"elect": true},
			description: "a single node with metadata must keep it after round-trip",
		},
		{
			name: "single node without metadata",
			nodes: map[string]models.Node{
				"plain": {ID: "plain", Title: "plain node"},
			},
			wantMeta:    map[string]bool{"plain": false},
			description: "a node that never ran /elect must have no metadata",
		},
		{
			name: "mixed nodes — only annotated node carries metadata",
			nodes: map[string]models.Node{
				"plain": {ID: "plain", Title: "no elect"},
				"elect": {ID: "elect", Title: "has elect", ReliabilityMetadata: func() *models.ReliabilityMetadata {
					m := minimalReliabilityMetadata()
					return &m
				}()},
			},
			wantMeta:    map[string]bool{"plain": false, "elect": true},
			description: "plain sibling must not acquire metadata when elect node has it",
		},
		{
			name: "multiple nodes each with independent metadata",
			nodes: map[string]models.Node{
				"elect-a": {ID: "elect-a", ReliabilityMetadata: &models.ReliabilityMetadata{
					WinnerForkIndex: intPtr(0), Mode: models.ElectModeStrict,
					SelectionLayer: models.SelectionLayerPrimary, Eligible: 1, Total: 2,
				}},
				"elect-b": {ID: "elect-b", ReliabilityMetadata: &models.ReliabilityMetadata{
					WinnerForkIndex: intPtr(1), Mode: models.ElectModeBackFall,
					SelectionLayer: models.SelectionLayerFallback, Eligible: 0, Total: 3,
				}},
			},
			wantMeta:    map[string]bool{"elect-a": true, "elect-b": true},
			description: "multiple /elect nodes must each keep their own independent metadata",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			wf := models.Workflow{WorkflowID: "wf", Nodes: tt.nodes}
			data, err := json.Marshal(wf)
			if err != nil {
				t.Fatalf("marshal failed: %v", err)
			}
			var restored models.Workflow
			if err := json.Unmarshal(data, &restored); err != nil {
				t.Fatalf("unmarshal failed: %v", err)
			}
			for nodeID, wantHasMeta := range tt.wantMeta {
				node, exists := restored.Nodes[nodeID]
				if !exists {
					t.Fatalf("%s: node %q missing from restored workflow", tt.description, nodeID)
				}
				hasMeta := node.ReliabilityMetadata != nil
				if hasMeta != wantHasMeta {
					t.Errorf("%s: node %q has metadata=%v, want %v",
						tt.description, nodeID, hasMeta, wantHasMeta)
				}
			}
			// Verify independent metadata values when multiple nodes have it
			if a, ok := restored.Nodes["elect-a"]; ok && a.ReliabilityMetadata != nil {
				if b, ok2 := restored.Nodes["elect-b"]; ok2 && b.ReliabilityMetadata != nil {
					if winnerForkIndexEqual(a.ReliabilityMetadata.WinnerForkIndex, b.ReliabilityMetadata.WinnerForkIndex) &&
						a.ReliabilityMetadata.Mode == b.ReliabilityMetadata.Mode {
						t.Error("independent /elect nodes must not share metadata state")
					}
				}
			}
		})
	}
}

// intPtr converts an int literal to a pointer, enabling inline assignment of *int fields.
func intPtr(v int) *int { return &v }

func winnerForkIndexEqual(a, b *int) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// Go nil and JSON null are distinct representations — the nil↔null round-trip must hold for commodity and no-winner paths.
func TestReliabilityMetadata_WinnerForkIndex_NullPath(t *testing.T) {
	tests := []struct {
		name        string
		mode        models.ElectMode
		description string
	}{
		{
			name:        "commodity mode nil winner",
			mode:        models.ElectModeCommodity,
			description: "commodity mode: no winner fork is selected; WinnerForkIndex must be null in JSON",
		},
		{
			name:        "fallback mode nil winner (no eligible fork promoted)",
			mode:        models.ElectModeBackFall,
			description: "fallback mode with nil winner: no fork met criteria and fallback found nothing to promote",
		},
		{
			name:        "strict mode nil winner (all forks below threshold)",
			mode:        models.ElectModeStrict,
			description: "strict mode with nil winner: all forks failed the quality threshold; no winner promoted",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := models.ReliabilityMetadata{
				WinnerForkIndex:     nil,
				Mode:                tt.mode,
				SelectionLayer:      models.SelectionLayerPrimary,
				PerCriterionVerdict: []models.CriterionVerdict{},
				Eligible:            0,
				Total:               3,
			}
			node := models.Node{ID: "n", ReliabilityMetadata: &m}

			rmRaw := extractRawFields(t, node)
			wfiBytes, present := rmRaw["winnerForkIndex"]
			if !present {
				t.Fatalf("%s: winnerForkIndex key must be present even when value is null", tt.description)
			}
			if string(wfiBytes) != "null" {
				t.Errorf("%s: winnerForkIndex must serialize as null, got %s", tt.description, wfiBytes)
			}

			restored := unmarshalNodeRoundTrip(t, node)
			if restored.ReliabilityMetadata == nil {
				t.Fatalf("%s: reliabilityMetadata must be non-nil after round-trip", tt.description)
			}
			if restored.ReliabilityMetadata.WinnerForkIndex != nil {
				t.Errorf("%s: WinnerForkIndex must be nil after round-trip, got %d",
					tt.description, *restored.ReliabilityMetadata.WinnerForkIndex)
			}
		})
	}
}

func TestReliabilityMetadata_InvalidMode_RoundTrip(t *testing.T) {
	tests := []struct {
		name         string
		failureCause models.ReliabilityFailureCause
		description  string
	}{
		{
			name:         "missing-parent cause",
			failureCause: models.ReliabilityFailureMissingParent,
			description:  "invalid mode with missing-parent cause must survive JSON round-trip",
		},
		{
			name:         "invalid-criteria cause",
			failureCause: models.ReliabilityFailureInvalidCriteria,
			description:  "invalid mode with invalid-criteria cause must survive JSON round-trip",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := models.ReliabilityMetadata{
				WinnerForkIndex:     nil,
				Mode:                models.ElectModeInvalid,
				SelectionLayer:      models.SelectionLayerPrimary,
				PerCriterionVerdict: []models.CriterionVerdict{},
				Eligible:            0,
				Total:               0,
				FailureCause:        tt.failureCause,
			}
			node := models.Node{ID: "n", ReliabilityMetadata: &m}

			data, err := json.Marshal(node)
			if err != nil {
				t.Fatalf("%s: marshal failed: %v", tt.description, err)
			}

			var restored models.Node
			if err := json.Unmarshal(data, &restored); err != nil {
				t.Fatalf("%s: unmarshal failed: %v", tt.description, err)
			}

			rm := restored.ReliabilityMetadata
			if rm == nil {
				t.Fatalf("%s: reliabilityMetadata must be non-nil after round-trip", tt.description)
			}
			if rm.Mode != models.ElectModeInvalid {
				t.Errorf("%s: Mode mismatch: want %q, got %q", tt.description, models.ElectModeInvalid, rm.Mode)
			}
			if rm.FailureCause != tt.failureCause {
				t.Errorf("%s: FailureCause mismatch: want %q, got %q", tt.description, tt.failureCause, rm.FailureCause)
			}
			if rm.WinnerForkIndex != nil {
				t.Errorf("%s: WinnerForkIndex must be nil (null) for invalid mode, got %v", tt.description, *rm.WinnerForkIndex)
			}
			if rm.Eligible != 0 {
				t.Errorf("%s: Eligible must be 0 for invalid mode, got %d", tt.description, rm.Eligible)
			}
			if rm.Total != 0 {
				t.Errorf("%s: Total must be 0 for invalid mode, got %d", tt.description, rm.Total)
			}
			if rm.SelectionLayer != models.SelectionLayerPrimary {
				t.Errorf("%s: SelectionLayer must be %q, got %q", tt.description, models.SelectionLayerPrimary, rm.SelectionLayer)
			}
			if rm.PerCriterionVerdict == nil {
				t.Errorf("%s: PerCriterionVerdict must be non-nil (empty slice, not null) after round-trip", tt.description)
			}
			if len(rm.PerCriterionVerdict) != 0 {
				t.Errorf("%s: PerCriterionVerdict must be empty, got len %d", tt.description, len(rm.PerCriterionVerdict))
			}
			rmRaw := extractRawFields(t, node)
			if _, present := rmRaw["failureCause"]; !present {
				t.Errorf("%s: failureCause key must be present in JSON output (not suppressed by omitempty)", tt.description)
			}
		})
	}
}

func TestReliabilityFailureCause_InvalidModeConstants(t *testing.T) {
	t.Run("ReliabilityFailureMissingParent value is missing-parent", func(t *testing.T) {
		if models.ReliabilityFailureMissingParent != "missing-parent" {
			t.Errorf("want %q, got %q", "missing-parent", models.ReliabilityFailureMissingParent)
		}
	})
	t.Run("ReliabilityFailureInvalidCriteria value is invalid-criteria", func(t *testing.T) {
		if models.ReliabilityFailureInvalidCriteria != "invalid-criteria" {
			t.Errorf("want %q, got %q", "invalid-criteria", models.ReliabilityFailureInvalidCriteria)
		}
	})
	t.Run("missing-parent and invalid-criteria are distinct values", func(t *testing.T) {
		if models.ReliabilityFailureMissingParent == models.ReliabilityFailureInvalidCriteria {
			t.Error("ReliabilityFailureMissingParent and ReliabilityFailureInvalidCriteria must be distinct")
		}
	})
}

func TestReliabilityMetadata_FallbackUsed_OmitemptyContract(t *testing.T) {
	t.Run("absent when SelectionLayer is none", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.SelectionLayer = models.SelectionLayerNone
		m.FallbackUsed = false
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		if _, present := rmRaw["fallbackUsed"]; present {
			t.Error("fallbackUsed must be absent from JSON when SelectionLayer is none — omitempty contract")
		}
	})

	t.Run("absent when SelectionLayer is primary", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.SelectionLayer = models.SelectionLayerPrimary
		m.FallbackUsed = false
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		if _, present := rmRaw["fallbackUsed"]; present {
			t.Error("fallbackUsed must be absent from JSON when false — omitempty contract")
		}
	})

	t.Run("absent when FallbackUsed is false even with fallback SelectionLayer", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.SelectionLayer = models.SelectionLayerFallback
		m.FallbackUsed = false
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		if _, present := rmRaw["fallbackUsed"]; present {
			t.Error("fallbackUsed must be absent from JSON when false regardless of SelectionLayer")
		}
	})

	t.Run("present and true when FallbackUsed is true", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.SelectionLayer = models.SelectionLayerFallback
		m.FallbackUsed = true
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		fuBytes, present := rmRaw["fallbackUsed"]
		if !present {
			t.Fatal("fallbackUsed must be present in JSON when true")
		}
		if string(fuBytes) != "true" {
			t.Errorf("fallbackUsed must serialize as true, got %s", fuBytes)
		}

		restored := unmarshalNodeRoundTrip(t, node)
		if !restored.ReliabilityMetadata.FallbackUsed {
			t.Error("FallbackUsed must be true after round-trip")
		}
	})
}

func TestReliabilityMetadata_GeneratorOnlyJudge_OmitemptyContract(t *testing.T) {
	t.Run("absent when false", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.GeneratorOnlyJudge = false
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		if _, present := rmRaw["generatorOnlyJudge"]; present {
			t.Error("generatorOnlyJudge must be absent from JSON when false — omitempty contract")
		}
	})

	t.Run("present and true when set", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.GeneratorOnlyJudge = true
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		gojBytes, present := rmRaw["generatorOnlyJudge"]
		if !present {
			t.Fatal("generatorOnlyJudge must be present in JSON when true")
		}
		if string(gojBytes) != "true" {
			t.Errorf("generatorOnlyJudge must serialize as true, got %s", gojBytes)
		}
		restored := unmarshalNodeRoundTrip(t, node)
		if !restored.ReliabilityMetadata.GeneratorOnlyJudge {
			t.Error("GeneratorOnlyJudge must be true after round-trip")
		}
	})
}

func TestReliabilityMetadata_JudgeReasoningRequested_OmitemptyContract(t *testing.T) {
	t.Run("absent when false", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.JudgeReasoningRequested = false
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		if _, present := rmRaw["judgeReasoningRequested"]; present {
			t.Error("judgeReasoningRequested must be absent from JSON when false — omitempty contract")
		}
	})

	t.Run("present and true when set", func(t *testing.T) {
		m := minimalReliabilityMetadata()
		m.JudgeReasoningRequested = true
		node := models.Node{ID: "n", ReliabilityMetadata: &m}
		rmRaw := extractRawFields(t, node)
		jrrBytes, present := rmRaw["judgeReasoningRequested"]
		if !present {
			t.Fatal("judgeReasoningRequested must be present in JSON when true")
		}
		if string(jrrBytes) != "true" {
			t.Errorf("judgeReasoningRequested must serialize as true, got %s", jrrBytes)
		}
		restored := unmarshalNodeRoundTrip(t, node)
		if !restored.ReliabilityMetadata.JudgeReasoningRequested {
			t.Error("JudgeReasoningRequested must be true after round-trip")
		}
	})
}

func TestReliabilityMetadata_CommodityMode_RoundTrip(t *testing.T) {
	m := models.ReliabilityMetadata{
		WinnerForkIndex:     nil,
		PerCriterionVerdict: []models.CriterionVerdict{},
		Mode:                models.ElectModeCommodity,
		SelectionLayer:      models.SelectionLayerPrimary,
		NoSignal:            false,
		Eligible:            3,
		Total:               3,
		DiscardedForks:      []models.DiscardedFork{},
	}
	node := models.Node{ID: "n", ReliabilityMetadata: &m}
	restored := unmarshalNodeRoundTrip(t, node)

	rm := restored.ReliabilityMetadata
	if rm == nil {
		t.Fatal("reliabilityMetadata must be non-nil after round-trip")
	}
	if rm.Mode != models.ElectModeCommodity {
		t.Errorf("Mode want %q, got %q", models.ElectModeCommodity, rm.Mode)
	}
	if rm.WinnerForkIndex != nil {
		t.Errorf("WinnerForkIndex must be nil, got %d", *rm.WinnerForkIndex)
	}
	if rm.Eligible != 3 {
		t.Errorf("Eligible want 3, got %d", rm.Eligible)
	}
	if rm.Total != 3 {
		t.Errorf("Total want 3, got %d", rm.Total)
	}
	if len(rm.DiscardedForks) != 0 {
		t.Errorf("DiscardedForks must be empty for full-success commodity, got %#v", rm.DiscardedForks)
	}
	if rm.JudgeInput != nil {
		t.Error("JudgeInput must be nil in commodity mode")
	}
	if len(rm.JudgeQualityWarnings) != 0 {
		t.Errorf("JudgeQualityWarnings must be empty for full-success commodity, got %#v", rm.JudgeQualityWarnings)
	}
	rmRaw := extractRawFields(t, node)
	if _, present := rmRaw["generatorOnlyJudge"]; present {
		t.Error("generatorOnlyJudge must be absent from JSON in commodity mode — omitempty contract")
	}
	if _, present := rmRaw["judgeReasoningRequested"]; present {
		t.Error("judgeReasoningRequested must be absent from JSON in commodity mode — omitempty contract")
	}
	if _, present := rmRaw["fallbackUsed"]; present {
		t.Error("fallbackUsed must be absent from JSON in commodity mode — omitempty contract")
	}
	if _, present := rmRaw["judgeQualityWarnings"]; present {
		t.Error("judgeQualityWarnings must be absent from JSON in full-success commodity — omitempty contract")
	}
}

func TestReliabilityMetadata_CommodityMode_PartialSuccess_RoundTrip(t *testing.T) {
	tests := []struct {
		name     string
		eligible int
		total    int
	}{
		{name: "minimal partial (1 of 2)", eligible: 1, total: 2},
		{name: "low partial (1 of 3)", eligible: 1, total: 3},
		{name: "near-full partial (2 of 3)", eligible: 2, total: 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			warning := models.JudgeQualityWarning{
				Condition: models.JudgeWarnCommodityPartialSuccess,
				Severity:  "medium",
			}
			m := models.ReliabilityMetadata{
				WinnerForkIndex:      nil,
				PerCriterionVerdict:  []models.CriterionVerdict{},
				Mode:                 models.ElectModeCommodity,
				SelectionLayer:       models.SelectionLayerPrimary,
				Eligible:             tt.eligible,
				Total:                tt.total,
				JudgeQualityWarnings: []models.JudgeQualityWarning{warning},
				DiscardedForks: []models.DiscardedFork{
					{ForkIndex: tt.total - 1, Status: models.ForkStatusRuntimeFailed},
				},
			}
			node := models.Node{ID: "n", ReliabilityMetadata: &m}
			restored := unmarshalNodeRoundTrip(t, node)

			rm := restored.ReliabilityMetadata
			if rm == nil {
				t.Fatal("reliabilityMetadata must be non-nil after round-trip")
			}
			if rm.Eligible != tt.eligible || rm.Total != tt.total {
				t.Errorf("Eligible/Total want %d/%d, got %d/%d",
					tt.eligible, tt.total, rm.Eligible, rm.Total)
			}
			if len(rm.JudgeQualityWarnings) != 1 {
				t.Fatalf("want 1 judgeQualityWarning, got %d", len(rm.JudgeQualityWarnings))
			}
			if rm.JudgeQualityWarnings[0].Condition != models.JudgeWarnCommodityPartialSuccess {
				t.Errorf("warning condition want %q, got %q",
					models.JudgeWarnCommodityPartialSuccess, rm.JudgeQualityWarnings[0].Condition)
			}
			if rm.JudgeQualityWarnings[0].Severity != "medium" {
				t.Errorf("warning severity want %q, got %q", "medium", rm.JudgeQualityWarnings[0].Severity)
			}
			rmRaw := extractRawFields(t, node)
			if _, present := rmRaw["judgeQualityWarnings"]; !present {
				t.Error("judgeQualityWarnings must be present in JSON for partial success")
			}
			if _, present := rmRaw["failureCause"]; present {
				t.Error("failureCause must be absent from JSON for partial success — only all-failed sets it")
			}
		})
	}
}

func minimalDiscardedFork(forkIndex int, status models.ForkStatus) models.DiscardedFork {
	return models.DiscardedFork{ForkIndex: forkIndex, Status: status}
}

// extractDiscardedForksRaw fatals unless reliabilityMetadata and discardedForks are both present
// in the marshalled Node, so callers can assert on entry contents without nil guards.
func extractDiscardedForksRaw(t *testing.T, node models.Node) []map[string]json.RawMessage {
	t.Helper()
	rmRaw := extractRawFields(t, node)
	dfBytes, present := rmRaw["discardedForks"]
	if !present {
		t.Fatal("discardedForks key must be present in reliabilityMetadata")
	}
	var entries []json.RawMessage
	if err := json.Unmarshal(dfBytes, &entries); err != nil {
		t.Fatalf("unmarshal discardedForks failed: %v", err)
	}
	result := make([]map[string]json.RawMessage, len(entries))
	for i, entry := range entries {
		if err := json.Unmarshal(entry, &result[i]); err != nil {
			t.Fatalf("unmarshal discardedForks[%d] failed: %v", i, err)
		}
	}
	return result
}

// nodeWithDiscardedForks is a test fixture for scenarios where only the DiscardedForks slice matters.
func nodeWithDiscardedForks(forks []models.DiscardedFork) models.Node {
	m := minimalReliabilityMetadata()
	m.DiscardedForks = forks
	return models.Node{ID: "n", ReliabilityMetadata: &m}
}

// ForkIndex zero must not be omitted — zero is a valid winner index, not a missing value.
func TestDiscardedFork_RequiredFields_RoundTrip(t *testing.T) {
	tests := []struct {
		name        string
		fork        models.DiscardedFork
		description string
	}{
		{
			name:        "ok status, fork index 0",
			fork:        minimalDiscardedFork(0, models.ForkStatusOK),
			description: "fork index 0 with ok status — both required fields must appear at zero value",
		},
		{
			name:        "criteria-failed status, fork index 0",
			fork:        minimalDiscardedFork(0, models.ForkStatusCriteriaFailed),
			description: "fork index 0 with criteria-failed status — required fields present at zero index",
		},
		{
			name:        "runtime-failed status, fork index 0",
			fork:        minimalDiscardedFork(0, models.ForkStatusRuntimeFailed),
			description: "fork index 0 with runtime-failed status — required fields present at zero index",
		},
		{
			name:        "ok status, non-zero fork index",
			fork:        minimalDiscardedFork(1, models.ForkStatusOK),
			description: "non-zero fork index with ok status — baseline non-zero case",
		},
		{
			name:        "criteria-failed status, non-zero fork index",
			fork:        minimalDiscardedFork(2, models.ForkStatusCriteriaFailed),
			description: "non-zero fork index with criteria-failed",
		},
		{
			name:        "runtime-failed status, non-zero fork index",
			fork:        minimalDiscardedFork(3, models.ForkStatusRuntimeFailed),
			description: "non-zero fork index with runtime-failed",
		},
		{
			name:        "empty-string status (zero value) must still appear as a key",
			fork:        models.DiscardedFork{ForkIndex: 1, Status: ""},
			description: "zero-value Status string must appear as a key — omitempty on Status is a contract violation",
		},
		{
			name:        "large fork index",
			fork:        minimalDiscardedFork(9, models.ForkStatusOK),
			description: "large fork index must survive without truncation or misidentification",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := nodeWithDiscardedForks([]models.DiscardedFork{tt.fork})

			entries := extractDiscardedForksRaw(t, node)
			if len(entries) != 1 {
				t.Fatalf("%s: expected 1 raw entry, got %d", tt.description, len(entries))
			}
			for _, key := range []string{"forkIndex", "status"} {
				if _, present := entries[0][key]; !present {
					t.Errorf("%s: required key %q must be present in JSON regardless of value", tt.description, key)
				}
			}

			restored := unmarshalNodeRoundTrip(t, node)
			if restored.ReliabilityMetadata == nil {
				t.Fatalf("%s: reliabilityMetadata must be non-nil after round-trip", tt.description)
			}
			forks := restored.ReliabilityMetadata.DiscardedForks
			if len(forks) != 1 {
				t.Fatalf("%s: DiscardedForks length want 1, got %d", tt.description, len(forks))
			}
			if forks[0].ForkIndex != tt.fork.ForkIndex {
				t.Errorf("%s: ForkIndex want %d, got %d", tt.description, tt.fork.ForkIndex, forks[0].ForkIndex)
			}
			if forks[0].Status != tt.fork.Status {
				t.Errorf("%s: Status want %q, got %q", tt.description, tt.fork.Status, forks[0].Status)
			}
		})
	}
}

// Each status emits a distinct field subset — absent fields must not appear as null or zero.
func TestDiscardedFork_OptionalFields_OmittedWhenAbsent(t *testing.T) {
	tests := []struct {
		name         string
		fork         models.DiscardedFork
		absentFields []string
		description  string
	}{
		{
			name:         "ok fork — all optional fields absent",
			fork:         minimalDiscardedFork(1, models.ForkStatusOK),
			absentFields: []string{"failedAt", "reason", "attempts"},
			description:  "a fork that passed the gate has no failure metadata",
		},
		{
			name:         "criteria-failed with only FailedAt — reason and attempts absent",
			fork:         models.DiscardedFork{ForkIndex: 1, Status: models.ForkStatusCriteriaFailed, FailedAt: "must mention revenue"},
			absentFields: []string{"reason", "attempts"},
			description:  "runtime-failed fields must not bleed into a criteria-failed fork",
		},
		{
			name: "criteria-failed with FailedAt and Attempts — only reason absent",
			fork: models.DiscardedFork{
				ForkIndex: 1,
				Status:    models.ForkStatusCriteriaFailed,
				FailedAt:  "must mention revenue",
				Attempts:  intPtr(3),
			},
			absentFields: []string{"reason"},
			description:  "runtime-failed reason must be absent even when both criteria-failed fields are present",
		},
		{
			name:         "runtime-failed with Reason — failedAt and attempts absent",
			fork:         models.DiscardedFork{ForkIndex: 2, Status: models.ForkStatusRuntimeFailed, Reason: "context deadline exceeded"},
			absentFields: []string{"failedAt", "attempts"},
			description:  "criteria-failed fields must not bleed into a runtime-failed fork",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := nodeWithDiscardedForks([]models.DiscardedFork{tt.fork})
			entries := extractDiscardedForksRaw(t, node)
			if len(entries) != 1 {
				t.Fatalf("%s: expected 1 entry, got %d", tt.description, len(entries))
			}
			for _, field := range tt.absentFields {
				if _, present := entries[0][field]; present {
					t.Errorf("%s: field %q must be absent from JSON when not set, got present", tt.description, field)
				}
			}
		})
	}
}

// Attempts uses *int to distinguish absent from present-with-value-0 — the zero-pointer case must not collapse to omitted.
func TestDiscardedFork_OptionalFields_PreservedWhenSet(t *testing.T) {
	tests := []struct {
		name        string
		fork        models.DiscardedFork
		verify      func(t *testing.T, f models.DiscardedFork)
		description string
	}{
		{
			name: "FailedAt alone",
			fork: models.DiscardedFork{
				ForkIndex: 1,
				Status:    models.ForkStatusCriteriaFailed,
				FailedAt:  "must include competitor names",
			},
			verify: func(t *testing.T, f models.DiscardedFork) {
				t.Helper()
				if f.FailedAt != "must include competitor names" {
					t.Errorf("FailedAt want %q, got %q", "must include competitor names", f.FailedAt)
				}
			},
			description: "FailedAt string must survive round-trip unchanged",
		},
		{
			name: "Attempts pointer to 3",
			fork: models.DiscardedFork{
				ForkIndex: 1,
				Status:    models.ForkStatusCriteriaFailed,
				Attempts:  intPtr(3),
			},
			verify: func(t *testing.T, f models.DiscardedFork) {
				t.Helper()
				if f.Attempts == nil {
					t.Fatal("Attempts must be non-nil")
				}
				if *f.Attempts != 3 {
					t.Errorf("Attempts want 3, got %d", *f.Attempts)
				}
			},
			description: "Attempts pointer to 3 must survive round-trip as non-nil pointer",
		},
		{
			name: "Attempts pointer to 1 — distinct from absent nil",
			fork: models.DiscardedFork{
				ForkIndex: 2,
				Status:    models.ForkStatusCriteriaFailed,
				Attempts:  intPtr(1),
			},
			verify: func(t *testing.T, f models.DiscardedFork) {
				t.Helper()
				if f.Attempts == nil {
					t.Fatal("Attempts must be non-nil — pointer to 1 is an explicit value, not absence")
				}
				if *f.Attempts != 1 {
					t.Errorf("Attempts want 1, got %d", *f.Attempts)
				}
			},
			description: "Attempts=1 must be preserved — value 1 is not the nil sentinel",
		},
		{
			name: "Attempts pointer to 0 — non-nil pointer with zero value",
			fork: models.DiscardedFork{
				ForkIndex: 3,
				Status:    models.ForkStatusCriteriaFailed,
				Attempts:  intPtr(0),
			},
			verify: func(t *testing.T, f models.DiscardedFork) {
				t.Helper()
				if f.Attempts == nil {
					t.Fatal("Attempts must be non-nil — *int pointer to 0 is an explicit zero, not absence")
				}
				if *f.Attempts != 0 {
					t.Errorf("Attempts want 0, got %d", *f.Attempts)
				}
			},
			description: "Attempts pointer-to-zero must survive — proves *int semantics over plain int with omitempty",
		},
		{
			name: "FailedAt and Attempts together",
			fork: models.DiscardedFork{
				ForkIndex: 1,
				Status:    models.ForkStatusCriteriaFailed,
				FailedAt:  "must cite revenue",
				Attempts:  intPtr(3),
			},
			verify: func(t *testing.T, f models.DiscardedFork) {
				t.Helper()
				if f.FailedAt != "must cite revenue" {
					t.Errorf("FailedAt want %q, got %q", "must cite revenue", f.FailedAt)
				}
				if f.Attempts == nil || *f.Attempts != 3 {
					t.Errorf("Attempts want ptr(3), got %v", f.Attempts)
				}
			},
			description: "both criteria-failed fields must survive together",
		},
		{
			name: "Reason alone",
			fork: models.DiscardedFork{
				ForkIndex: 0,
				Status:    models.ForkStatusRuntimeFailed,
				Reason:    "LLM returned HTTP 429",
			},
			verify: func(t *testing.T, f models.DiscardedFork) {
				t.Helper()
				if f.Reason != "LLM returned HTTP 429" {
					t.Errorf("Reason want %q, got %q", "LLM returned HTTP 429", f.Reason)
				}
			},
			description: "Reason string must survive round-trip unchanged",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			node := nodeWithDiscardedForks([]models.DiscardedFork{tt.fork})
			restored := unmarshalNodeRoundTrip(t, node)
			if restored.ReliabilityMetadata == nil {
				t.Fatalf("%s: reliabilityMetadata must be non-nil after round-trip", tt.description)
			}
			forks := restored.ReliabilityMetadata.DiscardedForks
			if len(forks) != 1 {
				t.Fatalf("%s: DiscardedForks length want 1, got %d", tt.description, len(forks))
			}
			tt.verify(t, forks[0])
		})
	}
}

// All three enum types (ForkStatus, ElectMode, SelectionLayer) share the same invariant — constant rename silently breaks the verdict drawer.
func TestDiscardedFork_EnumConstants_SerializeToCanonicalStrings(t *testing.T) {
	tests := []struct {
		value    models.ForkStatus
		wantJSON string
	}{
		{models.ForkStatusOK, `"ok"`},
		{models.ForkStatusCriteriaFailed, `"criteria-failed"`},
		{models.ForkStatusRuntimeFailed, `"runtime-failed"`},
	}
	for _, tt := range tests {
		t.Run(string(tt.value), func(t *testing.T) {
			got, err := json.Marshal(tt.value)
			if err != nil {
				t.Fatalf("marshal failed: %v", err)
			}
			if string(got) != tt.wantJSON {
				t.Errorf("ForkStatus %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
			}
		})
	}
}

// Same struct-tag invariant as TestReliabilityMetadata_JSONFieldNames, applied to the nested DiscardedFork type.
func TestDiscardedFork_JSONFieldNames(t *testing.T) {
	fork := models.DiscardedFork{
		ForkIndex: 1,
		Status:    models.ForkStatusCriteriaFailed,
		FailedAt:  "criterion text",
		Reason:    "error text",
		Attempts:  intPtr(2),
	}
	node := nodeWithDiscardedForks([]models.DiscardedFork{fork})
	entries := extractDiscardedForksRaw(t, node)
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	raw := entries[0]
	for _, key := range []string{"forkIndex", "status", "failedAt", "reason", "attempts"} {
		if _, present := raw[key]; !present {
			t.Errorf("required JSON key DiscardedFork.%q must be present when field is set", key)
		}
	}
}

// Frontend guards the drawer button with discardedForks?.length — nil and [] must both be absent, not serialized as null or [].
func TestReliabilityMetadata_DiscardedForks_Presence(t *testing.T) {
	tests := []struct {
		name        string
		forks       []models.DiscardedFork
		wantPresent bool
		description string
	}{
		{
			name:        "nil slice omitted",
			forks:       nil,
			wantPresent: false,
			description: "discardedForks key must be absent when the slice is nil",
		},
		{
			name:        "empty slice omitted",
			forks:       []models.DiscardedFork{},
			wantPresent: false,
			description: "discardedForks key must be absent when the slice is empty — same as nil",
		},
		{
			name:        "non-empty slice present",
			forks:       []models.DiscardedFork{minimalDiscardedFork(1, models.ForkStatusOK)},
			wantPresent: true,
			description: "discardedForks key must appear when the slice is non-empty",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := minimalReliabilityMetadata()
			m.DiscardedForks = tt.forks
			node := models.Node{ID: "n", ReliabilityMetadata: &m}
			data, err := json.Marshal(node)
			if err != nil {
				t.Fatalf("marshal failed: %v", err)
			}
			var nodeRaw map[string]json.RawMessage
			if err := json.Unmarshal(data, &nodeRaw); err != nil {
				t.Fatalf("unmarshal node failed: %v", err)
			}
			rmBytes, rmPresent := nodeRaw["reliabilityMetadata"]
			if !rmPresent {
				t.Fatal("reliabilityMetadata must be present")
			}
			var innerRaw map[string]json.RawMessage
			if err := json.Unmarshal(rmBytes, &innerRaw); err != nil {
				t.Fatalf("unmarshal reliabilityMetadata failed: %v", err)
			}
			_, present := innerRaw["discardedForks"]
			if present != tt.wantPresent {
				t.Errorf("%s: discardedForks present=%v, want %v", tt.description, present, tt.wantPresent)
			}
		})
	}
}

// Slice insertion order must be preserved across serialization — cross-status, cross-index, mixed optional fields.
func TestReliabilityMetadata_DiscardedForks_MultipleForksRoundTrip(t *testing.T) {
	m := minimalReliabilityMetadata()
	m.WinnerForkIndex = intPtr(2)
	m.Eligible = 1
	m.Total = 3
	m.DiscardedForks = []models.DiscardedFork{
		{
			ForkIndex: 0,
			Status:    models.ForkStatusCriteriaFailed,
			FailedAt:  "must include revenue numbers",
			Attempts:  intPtr(3),
		},
		{
			ForkIndex: 1,
			Status:    models.ForkStatusRuntimeFailed,
			Reason:    "context deadline exceeded",
		},
	}

	node := models.Node{ID: "n", ReliabilityMetadata: &m}
	restored := unmarshalNodeRoundTrip(t, node)

	rm := restored.ReliabilityMetadata
	if rm == nil {
		t.Fatal("reliabilityMetadata must be non-nil")
	}
	if len(rm.DiscardedForks) != 2 {
		t.Fatalf("DiscardedForks length want 2, got %d — slice length must be preserved", len(rm.DiscardedForks))
	}

	// Slice ordering: insertion order must be preserved through JSON serialisation.
	if rm.DiscardedForks[0].ForkIndex != 0 {
		t.Errorf("slice[0].ForkIndex want 0, got %d — insertion order must be preserved", rm.DiscardedForks[0].ForkIndex)
	}
	if rm.DiscardedForks[1].ForkIndex != 1 {
		t.Errorf("slice[1].ForkIndex want 1, got %d — insertion order must be preserved", rm.DiscardedForks[1].ForkIndex)
	}

	f0 := rm.DiscardedForks[0]
	if f0.Status != models.ForkStatusCriteriaFailed {
		t.Errorf("forks[0].Status want %q, got %q", models.ForkStatusCriteriaFailed, f0.Status)
	}
	if f0.FailedAt != "must include revenue numbers" {
		t.Errorf("forks[0].FailedAt want %q, got %q", "must include revenue numbers", f0.FailedAt)
	}
	if f0.Attempts == nil || *f0.Attempts != 3 {
		t.Errorf("forks[0].Attempts want ptr(3), got %v", f0.Attempts)
	}
	// Cross-status isolation: runtime-failed fields must be absent on a criteria-failed fork.
	if f0.Reason != "" {
		t.Errorf("forks[0].Reason must be empty on criteria-failed fork, got %q", f0.Reason)
	}

	f1 := rm.DiscardedForks[1]
	if f1.Status != models.ForkStatusRuntimeFailed {
		t.Errorf("forks[1].Status want %q, got %q", models.ForkStatusRuntimeFailed, f1.Status)
	}
	if f1.Reason != "context deadline exceeded" {
		t.Errorf("forks[1].Reason want %q, got %q", "context deadline exceeded", f1.Reason)
	}
	// Cross-status isolation: criteria-failed fields must be absent on a runtime-failed fork.
	if f1.FailedAt != "" {
		t.Errorf("forks[1].FailedAt must be empty on runtime-failed fork, got %q", f1.FailedAt)
	}
	if f1.Attempts != nil {
		t.Errorf("forks[1].Attempts must be nil on runtime-failed fork, got %v", *f1.Attempts)
	}
}
