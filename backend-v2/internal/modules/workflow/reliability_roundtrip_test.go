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

		optionalKeys := []string{"tiebreakUsed", "judgeInput", "judgeQualityWarnings"}
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
