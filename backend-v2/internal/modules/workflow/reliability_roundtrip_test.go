package workflow

import (
	"backend-v2/internal/models"
	"encoding/json"
	"testing"
)

// boolPtr converts a bool literal to a pointer, enabling inline assignment of *bool fields.
func boolPtr(v bool) *bool { return &v }

// minimalReliabilityMetadata returns a ReliabilityMetadata with only required fields set.
// All optional fields (TiebreakUsed, JudgeInput, JudgeQualityWarnings) are left nil/zero.
func minimalReliabilityMetadata() models.ReliabilityMetadata {
	return models.ReliabilityMetadata{
		WinnerForkIndex:     0,
		PerCriterionVerdict: []models.CriterionVerdict{},
		Mode:                models.RefineModeStrict,
		SelectionLayer:      models.SelectionLayerPrimary,
		NoSignal:            false,
		Eligible:            1,
		Total:               2,
	}
}

// unmarshalNodeRoundTrip marshals node to JSON then unmarshals back; fails the test on any error.
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

// extractRawFields deserializes a JSON-encoded Node and returns the reliabilityMetadata object
// as a raw key→value map, allowing key-presence assertions without interpreting values.
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

// TestNode_ReliabilityMetadata_Presence verifies the omitempty contract: a nil metadata pointer
// produces no JSON key; a non-nil pointer always produces the key regardless of field values.
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

// TestReliabilityMetadata_RequiredFields_RoundTrip verifies that every non-optional field —
// including zero/false/empty variants — survives JSON marshal→unmarshal unchanged.
// Required fields must appear in JSON and preserve their exact value, even when that value is the
// Go zero for its type (0 for int, false for bool, "" for string, [] for slice).
func TestReliabilityMetadata_RequiredFields_RoundTrip(t *testing.T) {
	tests := []struct {
		name        string
		metadata    models.ReliabilityMetadata
		description string
	}{
		{
			name: "winner is fork 0 (zero value must not be omitted)",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: 0,
				Mode:            models.RefineModeStrict,
				SelectionLayer:  models.SelectionLayerPrimary,
				Eligible:        1,
				Total:           1,
			},
			description: "WinnerForkIndex=0 must survive — fork 0 is a valid winner, not a missing value",
		},
		{
			name: "no-signal path with zero eligible and total",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: 0,
				Mode:            models.RefineModeStrict,
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
				WinnerForkIndex:     1,
				PerCriterionVerdict: []models.CriterionVerdict{},
				Mode:                models.RefineModeStrict,
				SelectionLayer:      models.SelectionLayerPrimary,
				Eligible:            2,
				Total:               3,
			},
			description: "empty PerCriterionVerdict slice must round-trip as an empty array, not null",
		},
		{
			name: "multiple criteria with multiple fork rankings",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: 2,
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
				Mode:           models.RefineModeStrict,
				SelectionLayer: models.SelectionLayerPrimary,
				Eligible:       3,
				Total:          3,
			},
			description: "multiple criteria and non-sequential fork indices must all survive",
		},
		{
			name: "strict mode with primary selection layer",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: 1,
				Mode:            models.RefineModeStrict,
				SelectionLayer:  models.SelectionLayerPrimary,
				Eligible:        2,
				Total:           3,
			},
			description: "strict+primary combination must round-trip correctly",
		},
		{
			name: "fallback mode with fallback selection layer",
			metadata: models.ReliabilityMetadata{
				WinnerForkIndex: 0,
				Mode:            models.RefineModeBackFall,
				SelectionLayer:  models.SelectionLayerFallback,
				Eligible:        0,
				Total:           2,
			},
			description: "fallback+fallback combination must round-trip correctly",
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
			if rm.WinnerForkIndex != orig.WinnerForkIndex {
				t.Errorf("%s: WinnerForkIndex want %d, got %d", tt.description, orig.WinnerForkIndex, rm.WinnerForkIndex)
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

// TestReliabilityMetadata_OptionalFields_OmittedWhenAbsent verifies that optional fields
// are absent from the JSON output when their Go value is nil or an empty slice.
// This prevents the frontend from receiving null/""/[] where it expects the key to be absent.
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
				WinnerForkIndex:      0,
				Mode:                 models.RefineModeStrict,
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
				WinnerForkIndex: 1,
				Mode:            models.RefineModeStrict,
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

// TestReliabilityMetadata_OptionalFields_PreservedWhenSet verifies that optional fields
// survive JSON round-trip with their exact values when explicitly set.
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

// TestReliabilityMetadata_EnumConstants_SerializeToCanonicalStrings verifies that every typed
// string constant serializes to the exact lowercase string value expected by the frontend.
// If any constant drifts from its JSON representation, the frontend verdict drawer breaks silently.
func TestReliabilityMetadata_EnumConstants_SerializeToCanonicalStrings(t *testing.T) {
	t.Run("RefineMode", func(t *testing.T) {
		tests := []struct {
			value    models.RefineMode
			wantJSON string
		}{
			{models.RefineModeStrict, `"strict"`},
			{models.RefineModeBackFall, `"fallback"`},
		}
		for _, tt := range tests {
			t.Run(string(tt.value), func(t *testing.T) {
				got, err := json.Marshal(tt.value)
				if err != nil {
					t.Fatalf("marshal failed: %v", err)
				}
				if string(got) != tt.wantJSON {
					t.Errorf("RefineMode %q: want JSON %s, got %s", tt.value, tt.wantJSON, got)
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

// TestReliabilityMetadata_JSONFieldNames verifies that Go struct field names produce the exact
// camelCase JSON keys the TypeScript frontend contract expects.
// A drift here (e.g. renaming a Go field) would silently break the verdict drawer and persist
// undetected until a browser session, because Go's json package uses the struct tag, not the name.
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

// TestWorkflow_Nodes_ReliabilityMetadata_Isolation verifies that in a workflow with multiple
// nodes, reliabilityMetadata is independent per node: setting it on one node does not affect
// others, and nodes that never ran /refine carry no metadata after round-trip.
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
				"refine": {ID: "refine", ReliabilityMetadata: func() *models.ReliabilityMetadata {
					m := minimalReliabilityMetadata()
					return &m
				}()},
			},
			wantMeta:    map[string]bool{"refine": true},
			description: "a single node with metadata must keep it after round-trip",
		},
		{
			name: "single node without metadata",
			nodes: map[string]models.Node{
				"plain": {ID: "plain", Title: "plain node"},
			},
			wantMeta:    map[string]bool{"plain": false},
			description: "a node that never ran /refine must have no metadata",
		},
		{
			name: "mixed nodes — only annotated node carries metadata",
			nodes: map[string]models.Node{
				"plain": {ID: "plain", Title: "no refine"},
				"refine": {ID: "refine", Title: "has refine", ReliabilityMetadata: func() *models.ReliabilityMetadata {
					m := minimalReliabilityMetadata()
					return &m
				}()},
			},
			wantMeta:    map[string]bool{"plain": false, "refine": true},
			description: "plain sibling must not acquire metadata when refine node has it",
		},
		{
			name: "multiple nodes each with independent metadata",
			nodes: map[string]models.Node{
				"refine-a": {ID: "refine-a", ReliabilityMetadata: &models.ReliabilityMetadata{
					WinnerForkIndex: 0, Mode: models.RefineModeStrict,
					SelectionLayer: models.SelectionLayerPrimary, Eligible: 1, Total: 2,
				}},
				"refine-b": {ID: "refine-b", ReliabilityMetadata: &models.ReliabilityMetadata{
					WinnerForkIndex: 1, Mode: models.RefineModeBackFall,
					SelectionLayer: models.SelectionLayerFallback, Eligible: 0, Total: 3,
				}},
			},
			wantMeta:    map[string]bool{"refine-a": true, "refine-b": true},
			description: "multiple /refine nodes must each keep their own independent metadata",
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
			if a, ok := restored.Nodes["refine-a"]; ok && a.ReliabilityMetadata != nil {
				if b, ok2 := restored.Nodes["refine-b"]; ok2 && b.ReliabilityMetadata != nil {
					if a.ReliabilityMetadata.WinnerForkIndex == b.ReliabilityMetadata.WinnerForkIndex &&
						a.ReliabilityMetadata.Mode == b.ReliabilityMetadata.Mode {
						t.Error("independent /refine nodes must not share metadata state")
					}
				}
			}
		})
	}
}

// intPtr converts an int literal to a pointer, enabling inline assignment of *int fields.
func intPtr(v int) *int { return &v }

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

// TestDiscardedFork_RequiredFields_RoundTrip verifies two invariants of the required fields
// (ForkIndex and Status) across all valid status values and representative index values:
//
//  1. Key presence: both fields appear in the marshalled JSON regardless of their value,
//     including when ForkIndex is zero and Status is the empty string.
//  2. Value fidelity: the deserialized values exactly match the originals.
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

// TestDiscardedFork_OptionalFields_OmittedWhenAbsent verifies that the three role-specific
// optional fields (FailedAt, Reason, Attempts) are absent from JSON when not set by the engine.
// Each row represents one canonical fork state emitted by the Node.js engine and enumerates
// exactly which fields must be absent for that state.
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

// TestDiscardedFork_OptionalFields_PreservedWhenSet verifies that FailedAt, Reason, and Attempts
// survive JSON round-trip with their exact values when explicitly provided.
// The Attempts field uses *int to distinguish "absent" from "present with value 0" —
// the zero-pointer case is tested explicitly to prove the pointer semantics are correct.
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

// TestDiscardedFork_EnumConstants_SerializeToCanonicalStrings verifies that every ForkStatus
// constant serializes to the exact wire string the Node.js engine writes and the frontend reads.
// A drift (e.g. renaming the constant) would break the verdict drawer silently, just as drifting
// RefineMode or SelectionLayer would — all three enum types are governed by the same invariant.
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

// TestDiscardedFork_JSONFieldNames verifies that every DiscardedFork struct field serializes to
// the exact camelCase JSON key that the TypeScript DiscardedFork type and the Node.js engine use.
// Mirrors TestReliabilityMetadata_JSONFieldNames for the nested DiscardedFork struct.
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

// TestReliabilityMetadata_DiscardedForks_Presence verifies the omitempty contract for the
// DiscardedForks slice at the ReliabilityMetadata level: nil and empty slices must be absent
// from JSON (the frontend guards the drawer button with discardedForks?.length, treating nil
// and [] identically); a non-empty slice must produce the discardedForks key.
// Mirrors TestNode_ReliabilityMetadata_Presence for the same omitempty contract on a slice field.
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

// TestReliabilityMetadata_DiscardedForks_MultipleForksRoundTrip exercises a realistic N=3
// best-of-N scenario: winner=fork 2, fork 0 criteria-failed, fork 1 runtime-failed.
// It verifies the full combination of cross-status, cross-index, and mixed optional fields,
// and explicitly asserts that the slice preserves insertion order across serialisation.
func TestReliabilityMetadata_DiscardedForks_MultipleForksRoundTrip(t *testing.T) {
	m := minimalReliabilityMetadata()
	m.WinnerForkIndex = 2
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
