package workflow

import (
	"backend-v2/internal/models"
	"reflect"
	"strings"
	"testing"
)

// structTagName returns the key portion of a struct field tag value,
// stripping any options after the first comma (e.g. "field,omitempty" → "field").
// An empty tag returns an empty string; "-" returns "-".
func structTagName(tag string) string {
	if idx := strings.IndexByte(tag, ','); idx != -1 {
		return tag[:idx]
	}
	return tag
}

// structTagHasOption reports whether option appears in the comma-separated options
// portion of a struct field tag (e.g. "field,omitempty" has option "omitempty").
func structTagHasOption(tag, option string) bool {
	for _, part := range strings.Split(tag, ",")[1:] {
		if part == option {
			return true
		}
	}
	return false
}

// assertBSONTagParity walks every exported field reachable from typ and fails when any
// of the following conditions hold for a field that carries a json tag:
//
//   - The field has a json tag but no bson tag.
//     mongo-driver maps untagged fields to strings.ToLower(fieldName), which diverges
//     from camelCase json names (e.g. WinnerForkIndex → "winnerforkindex" ≠ "winnerForkIndex").
//
//   - The json key and bson key differ.
//     Divergent names mean the HTTP response and MongoDB document use different keys for
//     the same field — a GET after reload returns a different shape than a GET after write.
//
//   - The field carries bson:"-" while its json tag is not "-".
//     The field persists in HTTP responses but is silently dropped from MongoDB documents.
//
//   - The omitempty option is present in one serializer tag but absent in the other.
//     Asymmetric omitempty means a zero-value field can be absent in one serializer
//     and present in the other, producing divergent round-trips through HTTP vs. MongoDB.
//
// Fields with json:"-" are skipped entirely: the field is excluded from JSON, so its
// nested types have no json↔bson parity concern within this path.
// Unexported fields are skipped: they are inaccessible to both serializers.
//
// Pointer, slice, and array indirections are peeled before descending into struct types.
// visited guards against cycles (forward-declared or mutually recursive types).
func assertBSONTagParity(t *testing.T, typ reflect.Type, path string, visited map[reflect.Type]bool) {
	t.Helper()

	for typ.Kind() == reflect.Ptr || typ.Kind() == reflect.Slice || typ.Kind() == reflect.Array {
		typ = typ.Elem()
	}
	if typ.Kind() != reflect.Struct || visited[typ] {
		return
	}
	visited[typ] = true

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		if !field.IsExported() {
			continue
		}

		jsonTag := field.Tag.Get("json")
		bsonTag := field.Tag.Get("bson")
		jsonName := structTagName(jsonTag)
		bsonName := structTagName(bsonTag)
		fieldPath := path + "." + field.Name

		if jsonName == "-" {
			// Field is excluded from JSON. Its nested types have no parity concern for
			// this serialization path, so recursion is also skipped.
			continue
		}

		switch {
		case bsonName == "-":
			t.Errorf(
				"field %s: json tag %q present but bson:\"-\" — field is included in HTTP responses but silently dropped from MongoDB documents",
				fieldPath, jsonName,
			)

		case jsonName != "" && bsonTag == "":
			t.Errorf(
				"field %s: json tag %q present but no bson tag — mongo-driver writes key %q (lowercased field name) instead of %q; add `bson:%q`",
				fieldPath, jsonName, strings.ToLower(field.Name), jsonName, jsonName,
			)

		case jsonName != "" && jsonName != bsonName:
			t.Errorf(
				"field %s: json key %q ≠ bson key %q — HTTP response and MongoDB document use different field names for the same data",
				fieldPath, jsonName, bsonName,
			)

		case jsonName != "":
			// Key names match. Verify that omitempty is symmetric so zero-value presence
			// is consistent between HTTP and MongoDB serialization.
			jsonOmit := structTagHasOption(jsonTag, "omitempty")
			bsonOmit := structTagHasOption(bsonTag, "omitempty")
			if jsonOmit && !bsonOmit {
				t.Errorf(
					"field %s: json tag has omitempty but bson tag does not — zero-value field is absent from HTTP responses but present in MongoDB documents",
					fieldPath,
				)
			}
			if !jsonOmit && bsonOmit {
				t.Errorf(
					"field %s: bson tag has omitempty but json tag does not — zero-value field always appears in HTTP responses but is silently absent from MongoDB documents after reload",
					fieldPath,
				)
			}
		}

		assertBSONTagParity(t, field.Type, fieldPath, visited)
	}
}

// TestReliabilityMetadata_BSONTagParity is the BSON-persistence arm of the engine↔persistence
// contract. It complements TestReliabilityMetadata_Contract_FixturePreservation (which exercises
// JSON round-trip via encoding/json) by verifying that the struct definitions themselves guarantee
// consistent field names across both serialization paths.
//
// A field added with only a json tag passes the JSON gate but silently diverges in MongoDB:
// mongo-driver uses strings.ToLower(fieldName) for untagged fields, which differs from the
// camelCase json name for every multi-word field — the field is written correctly via HTTP
// but is written to a wrong key in MongoDB and cannot be found after a process restart.
func TestReliabilityMetadata_BSONTagParity(t *testing.T) {
	assertBSONTagParity(
		t,
		reflect.TypeOf(models.ReliabilityMetadata{}),
		"ReliabilityMetadata",
		make(map[reflect.Type]bool),
	)
}

// TestAssertBSONTagParity_Helper guards the parity walker so that a bug in the walker
// does not silently suppress real divergences in the production gate.
//
// Sub-tests are grouped into three categories:
//   - Detection: the walker must fail on a given struct shape.
//   - Passing: the walker must not fail on a given struct shape.
//   - Traversal: the walker must reach fields at every depth and through every container kind.
func TestAssertBSONTagParity_Helper(t *testing.T) {
	run := func(name string, typ reflect.Type) (failed bool) {
		sub := &testing.T{}
		assertBSONTagParity(sub, typ, "root", make(map[reflect.Type]bool))
		return sub.Failed()
	}

	// — Detection — walker must report a failure for each shape below.

	t.Run("detects json tag without bson tag", func(t *testing.T) {
		type s struct {
			Field string `json:"myField"`
		}
		if !run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("expected failure: json tag present, bson tag absent")
		}
	})

	t.Run("detects json and bson key mismatch", func(t *testing.T) {
		type s struct {
			Field string `json:"myField" bson:"other_key"`
		}
		if !run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("expected failure: json key and bson key differ")
		}
	})

	t.Run("detects bson exclusion while json tag is present", func(t *testing.T) {
		type s struct {
			Field string `json:"myField" bson:"-"`
		}
		if !run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("expected failure: field in json but excluded from bson")
		}
	})

	t.Run("detects omitempty in json but not in bson", func(t *testing.T) {
		type s struct {
			Field string `json:"field,omitempty" bson:"field"`
		}
		if !run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("expected failure: omitempty present in json but absent in bson")
		}
	})

	t.Run("detects omitempty in bson but not in json", func(t *testing.T) {
		type s struct {
			Field string `json:"field" bson:"field,omitempty"`
		}
		if !run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("expected failure: omitempty present in bson but absent in json")
		}
	})

	// — Passing — walker must not report a failure for each shape below.

	t.Run("passes for matching keys without omitempty", func(t *testing.T) {
		type s struct {
			Name string `json:"name" bson:"name"`
		}
		if run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("unexpected failure: matching keys, no omitempty on either side")
		}
	})

	t.Run("passes for matching keys with symmetric omitempty", func(t *testing.T) {
		type s struct {
			Name string `json:"name,omitempty" bson:"name,omitempty"`
		}
		if run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("unexpected failure: matching keys with omitempty on both sides")
		}
	})

	t.Run("passes when field is excluded from json", func(t *testing.T) {
		type s struct {
			Internal string `json:"-" bson:"internal"`
		}
		if run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("unexpected failure: json:\"-\" field should be skipped entirely")
		}
	})

	t.Run("passes when field has no tags at all", func(t *testing.T) {
		type s struct {
			Plain string
		}
		if run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("unexpected failure: field with no tags has no parity requirement")
		}
	})

	t.Run("passes for struct containing unexported fields", func(t *testing.T) {
		type s struct {
			Exported   string `json:"exported" bson:"exported"`
			unexported string //nolint:unused // walker must not inspect unexported fields
		}
		if run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("unexpected failure: unexported fields are inaccessible to serializers and must be skipped")
		}
	})

	t.Run("passes for pointer to scalar type", func(t *testing.T) {
		type s struct {
			Count *int `json:"count" bson:"count"`
		}
		if run(t.Name(), reflect.TypeOf(s{})) {
			t.Error("unexpected failure: pointer to scalar has no nested struct to recurse into")
		}
	})

	// — Traversal — walker must reach fields at every depth and through every container kind.

	t.Run("recurses into directly embedded struct", func(t *testing.T) {
		type inner struct {
			Field string `json:"field"` // missing bson
		}
		type outer struct {
			Sub inner `json:"sub" bson:"sub"`
		}
		if !run(t.Name(), reflect.TypeOf(outer{})) {
			t.Error("expected failure: missing bson tag inside directly embedded struct")
		}
	})

	t.Run("recurses through pointer to struct", func(t *testing.T) {
		type inner struct {
			Field string `json:"field"` // missing bson
		}
		type outer struct {
			Ptr *inner `json:"ptr" bson:"ptr"`
		}
		if !run(t.Name(), reflect.TypeOf(outer{})) {
			t.Error("expected failure: missing bson tag reached through pointer to struct")
		}
	})

	t.Run("recurses through slice of structs", func(t *testing.T) {
		type item struct {
			Field string `json:"field"` // missing bson
		}
		type outer struct {
			Items []item `json:"items" bson:"items"`
		}
		if !run(t.Name(), reflect.TypeOf(outer{})) {
			t.Error("expected failure: missing bson tag inside slice element type")
		}
	})

	t.Run("recurses through array of structs", func(t *testing.T) {
		type item struct {
			Field string `json:"field"` // missing bson
		}
		type outer struct {
			Items [3]item `json:"items" bson:"items"`
		}
		if !run(t.Name(), reflect.TypeOf(outer{})) {
			t.Error("expected failure: missing bson tag inside fixed-size array element type")
		}
	})

	t.Run("recurses to depth 3 and detects violation in innermost struct", func(t *testing.T) {
		type innermost struct {
			Deep string `json:"deep"` // missing bson
		}
		type middle struct {
			Inner innermost `json:"inner" bson:"inner"`
		}
		type outer struct {
			Mid middle `json:"mid" bson:"mid"`
		}
		if !run(t.Name(), reflect.TypeOf(outer{})) {
			t.Error("expected failure: missing bson tag at depth 3")
		}
	})

	t.Run("skips subtree of json-excluded field even if nested type has violations", func(t *testing.T) {
		type inner struct {
			Field string `json:"field"` // would violate parity, but parent is excluded from json
		}
		type outer struct {
			Excluded inner `json:"-" bson:"excluded"`
		}
		if run(t.Name(), reflect.TypeOf(outer{})) {
			t.Error("unexpected failure: nested type under json:\"-\" field must not be walked")
		}
	})

	t.Run("does not re-enter an already-visited type", func(t *testing.T) {
		type leaf struct {
			Value string `json:"value" bson:"value"`
		}
		sub := &testing.T{}
		visited := make(map[reflect.Type]bool)
		visited[reflect.TypeOf(leaf{})] = true
		assertBSONTagParity(sub, reflect.TypeOf(leaf{}), "leaf", visited)
		if sub.Failed() {
			t.Error("unexpected failure: pre-visited type must be skipped without error")
		}
	})
}
