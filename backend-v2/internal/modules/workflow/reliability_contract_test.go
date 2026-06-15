package workflow

import (
	"backend-v2/internal/models"
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

// assertJSONKeysPreserved fails at the exact field path where round-trip drops a key,
// so the error message names the Go struct field that needs a json tag rather than just "field missing".
func assertJSONKeysPreserved(t *testing.T, fixture, roundTripped json.RawMessage, path string) {
	t.Helper()

	var fMap map[string]json.RawMessage
	if err := json.Unmarshal(fixture, &fMap); err == nil {
		var rtMap map[string]json.RawMessage
		if err2 := json.Unmarshal(roundTripped, &rtMap); err2 != nil {
			t.Errorf("path %q: Go round-trip changed shape from object to non-object", path)
			return
		}
		for k, fVal := range fMap {
			rtVal, present := rtMap[k]
			if !present {
				t.Errorf("Go struct silently drops field at path %q — add json tag to the corresponding models struct field", path+"."+k)
				continue
			}
			assertJSONKeysPreserved(t, fVal, rtVal, path+"."+k)
		}
		return
	}

	var fArr []json.RawMessage
	if err := json.Unmarshal(fixture, &fArr); err == nil {
		var rtArr []json.RawMessage
		if err2 := json.Unmarshal(roundTripped, &rtArr); err2 != nil {
			t.Errorf("path %q: Go round-trip changed shape from array to non-array", path)
			return
		}
		for i, fEl := range fArr {
			if i >= len(rtArr) {
				t.Errorf("path %q: array truncated — fixture has %d elements, round-trip has %d", path, len(fArr), len(rtArr))
				return
			}
			assertJSONKeysPreserved(t, fEl, rtArr[i], fmt.Sprintf("%s[%d]", path, i))
		}
		return
	}
	// Scalar — no field names to check; value fidelity is covered by the round-trip tests.
}

func readFixture(t *testing.T) json.RawMessage {
	t.Helper()
	b, err := os.ReadFile("testdata/reliability_metadata_maximal.json")
	if err != nil {
		t.Fatalf("cannot read fixture: %v — run from backend-v2/internal/modules/workflow/", err)
	}
	return b
}

// TestReliabilityMetadata_Contract_FixturePreservation is the divergence-detection gate for
// the engine↔persistence contract. Adding a field to the JS engine without a matching json tag
// in the Go struct makes this test fail — rather than a browser session six weeks later.
func TestReliabilityMetadata_Contract_FixturePreservation(t *testing.T) {
	fixtureBytes := readFixture(t)

	var meta models.ReliabilityMetadata
	if err := json.Unmarshal(fixtureBytes, &meta); err != nil {
		t.Fatalf("fixture is not valid ReliabilityMetadata JSON: %v", err)
	}

	roundTrippedBytes, err := json.Marshal(meta)
	if err != nil {
		t.Fatalf("marshal after unmarshal failed: %v", err)
	}

	assertJSONKeysPreserved(t, fixtureBytes, roundTrippedBytes, "reliabilityMetadata")
}

// TestReliabilityMetadata_Contract_FixtureIsMaximal guards against an incomplete fixture
// silently giving both sides a false green — if an optional field is stripped from the fixture,
// FixturePreservation can no longer detect a Go struct regression for that field.
func TestReliabilityMetadata_Contract_FixtureIsMaximal(t *testing.T) {
	fixtureBytes := readFixture(t)

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(fixtureBytes, &raw); err != nil {
		t.Fatalf("fixture is not valid JSON object: %v", err)
	}

	requiredTopLevel := []string{
		"winnerForkIndex", "perCriterionVerdict", "mode", "selectionLayer",
		"noSignal", "eligible", "total",
	}
	optionalTopLevel := []string{"tiebreakUsed", "judgeInput", "judgeQualityWarnings", "discardedForks"}

	for _, key := range append(requiredTopLevel, optionalTopLevel...) {
		if _, present := raw[key]; !present {
			t.Errorf("fixture is missing top-level key %q — fixture must be maximal so the contract test covers all fields", key)
		}
	}

	var jiRaw map[string]json.RawMessage
	if err := json.Unmarshal(raw["judgeInput"], &jiRaw); err != nil {
		t.Fatalf("fixture judgeInput is not a valid JSON object: %v", err)
	}
	for _, key := range []string{"candidateCount", "perForkBudgetChars", "degradedInput", "resolvedJudgeFamilies"} {
		if _, present := jiRaw[key]; !present {
			t.Errorf("fixture judgeInput is missing key %q — all JudgeInputMetadata fields must be represented", key)
		}
	}

	// omitempty on optional DiscardedFork fields (failedAt, reason, attempts) would be undetectable unless all three appear here.
	var dfArr []json.RawMessage
	if err := json.Unmarshal(raw["discardedForks"], &dfArr); err != nil || len(dfArr) == 0 {
		t.Fatalf("fixture discardedForks must be a non-empty array")
	}
	var dfRaw map[string]json.RawMessage
	if err := json.Unmarshal(dfArr[0], &dfRaw); err != nil {
		t.Fatalf("fixture discardedForks[0] is not a valid JSON object: %v", err)
	}
	for _, key := range []string{"forkIndex", "status", "failedAt", "reason", "attempts"} {
		if _, present := dfRaw[key]; !present {
			t.Errorf("fixture discardedForks[0] is missing key %q — all DiscardedFork fields must be represented", key)
		}
	}

	// ForkRanking's json tags are only covered if forkRankings is non-empty here.
	var pcvArr []json.RawMessage
	if err := json.Unmarshal(raw["perCriterionVerdict"], &pcvArr); err != nil || len(pcvArr) == 0 {
		t.Fatalf("fixture perCriterionVerdict must be a non-empty array")
	}
	var pcvRaw map[string]json.RawMessage
	if err := json.Unmarshal(pcvArr[0], &pcvRaw); err != nil {
		t.Fatalf("fixture perCriterionVerdict[0] is not a valid JSON object: %v", err)
	}
	var rankingsArr []json.RawMessage
	if err := json.Unmarshal(pcvRaw["forkRankings"], &rankingsArr); err != nil || len(rankingsArr) == 0 {
		t.Fatalf("fixture perCriterionVerdict[0].forkRankings must be a non-empty array — ForkRanking struct must be covered")
	}
}

// TestAssertJSONKeysPreserved_Helper guards against a bug in the helper silently suppressing
// real contract failures.
func TestAssertJSONKeysPreserved_Helper(t *testing.T) {
	t.Run("detects missing key in top-level object", func(t *testing.T) {
		sub := &testing.T{}
		assertJSONKeysPreserved(
			sub,
			json.RawMessage(`{"a":1,"b":2}`),
			json.RawMessage(`{"a":1}`),
			"root",
		)
		if !sub.Failed() {
			t.Error("expected helper to fail when a key is missing from round-trip object")
		}
	})

	t.Run("passes when all object keys are preserved", func(t *testing.T) {
		sub := &testing.T{}
		assertJSONKeysPreserved(
			sub,
			json.RawMessage(`{"a":1,"b":2}`),
			json.RawMessage(`{"a":1,"b":2}`),
			"root",
		)
		if sub.Failed() {
			t.Error("expected helper to pass when all keys are present")
		}
	})

	t.Run("recurses into nested objects and detects missing nested key", func(t *testing.T) {
		sub := &testing.T{}
		assertJSONKeysPreserved(
			sub,
			json.RawMessage(`{"outer":{"inner":1}}`),
			json.RawMessage(`{"outer":{}}`),
			"root",
		)
		if !sub.Failed() {
			t.Error("expected helper to fail when a nested key is missing")
		}
	})

	t.Run("recurses into array elements and detects missing element key", func(t *testing.T) {
		sub := &testing.T{}
		assertJSONKeysPreserved(
			sub,
			json.RawMessage(`[{"a":1,"b":2}]`),
			json.RawMessage(`[{"a":1}]`),
			"root",
		)
		if !sub.Failed() {
			t.Error("expected helper to fail when a key inside an array element is missing")
		}
	})

	t.Run("passes when round-trip array element has all fixture keys", func(t *testing.T) {
		sub := &testing.T{}
		assertJSONKeysPreserved(
			sub,
			json.RawMessage(`[{"a":1}]`),
			json.RawMessage(`[{"a":1}]`),
			"root",
		)
		if sub.Failed() {
			t.Error("expected helper to pass for matching array element shape")
		}
	})

	t.Run("detects array truncation in round-trip output", func(t *testing.T) {
		sub := &testing.T{}
		assertJSONKeysPreserved(
			sub,
			json.RawMessage(`[{"a":1},{"b":2}]`),
			json.RawMessage(`[{"a":1}]`),
			"root",
		)
		if !sub.Failed() {
			t.Error("expected helper to fail when round-trip array has fewer elements than fixture")
		}
	})

	t.Run("scalar values terminate walk without failure", func(t *testing.T) {
		sub := &testing.T{}
		assertJSONKeysPreserved(sub, json.RawMessage(`42`), json.RawMessage(`42`), "root")
		assertJSONKeysPreserved(sub, json.RawMessage(`"text"`), json.RawMessage(`"text"`), "root")
		assertJSONKeysPreserved(sub, json.RawMessage(`true`), json.RawMessage(`true`), "root")
		if sub.Failed() {
			t.Error("expected helper to pass silently for scalar values")
		}
	})
}
