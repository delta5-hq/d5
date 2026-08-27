package integration

import (
	"strings"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestDocumentEmptinessChecker_IsEmpty(t *testing.T) {
	checker := NewDocumentEmptinessChecker()

	tests := []struct {
		name     string
		doc      map[string]interface{}
		expected bool
	}{
		{
			name:     "empty document with only metadata",
			doc:      map[string]interface{}{"userId": "u1", "workflowId": "w1"},
			expected: true,
		},
		{
			name:     "document with openai",
			doc:      map[string]interface{}{"userId": "u1", "openai": map[string]interface{}{"apiKey": "key"}},
			expected: false,
		},
		{
			name:     "document with claude",
			doc:      map[string]interface{}{"userId": "u1", "claude": map[string]interface{}{"apiKey": "key"}},
			expected: false,
		},
		{
			name:     "document with qwen",
			doc:      map[string]interface{}{"userId": "u1", "qwen": map[string]interface{}{"apiKey": "key"}},
			expected: false,
		},
		{
			name:     "document with deepseek",
			doc:      map[string]interface{}{"userId": "u1", "deepseek": map[string]interface{}{"apiKey": "key"}},
			expected: false,
		},
		{
			name:     "document with perplexity",
			doc:      map[string]interface{}{"userId": "u1", "perplexity": map[string]interface{}{"apiKey": "key"}},
			expected: false,
		},
		{
			name:     "document with yandex",
			doc:      map[string]interface{}{"userId": "u1", "yandex": map[string]interface{}{"apiKey": "key"}},
			expected: false,
		},
		{
			name:     "document with custom_llm",
			doc:      map[string]interface{}{"userId": "u1", "custom_llm": map[string]interface{}{"apiRootUrl": "url"}},
			expected: false,
		},
		{
			name: "document with mcp items",
			doc: map[string]interface{}{
				"userId": "u1",
				"mcp":    []interface{}{map[string]interface{}{"alias": "/test"}},
			},
			expected: false,
		},
		{
			name: "document with rpc items",
			doc: map[string]interface{}{
				"userId": "u1",
				"rpc":    []interface{}{map[string]interface{}{"alias": "/test"}},
			},
			expected: false,
		},
		{
			name: "document with empty mcp array",
			doc: map[string]interface{}{
				"userId": "u1",
				"mcp":    []interface{}{},
			},
			expected: true,
		},
		{
			name: "document with empty rpc array",
			doc: map[string]interface{}{
				"userId": "u1",
				"rpc":    []interface{}{},
			},
			expected: true,
		},
		{
			name: "document with mcp and rpc but both empty",
			doc: map[string]interface{}{
				"userId": "u1",
				"mcp":    []interface{}{},
				"rpc":    []interface{}{},
			},
			expected: true,
		},
		{
			name: "document with llm and mcp items",
			doc: map[string]interface{}{
				"userId": "u1",
				"openai": map[string]interface{}{"apiKey": "key"},
				"mcp":    []interface{}{map[string]interface{}{"alias": "/test"}},
			},
			expected: false,
		},
		{
			name:     "document with nil llm field",
			doc:      map[string]interface{}{"userId": "u1", "openai": nil},
			expected: true,
		},
		{
			name: "document with primitive.A mcp items",
			doc: map[string]interface{}{
				"userId": "u1",
				"mcp":    primitive.A{map[string]interface{}{"alias": "/test"}},
			},
			expected: false,
		},
		{
			name: "document with primitive.A rpc items",
			doc: map[string]interface{}{
				"userId": "u1",
				"rpc":    primitive.A{map[string]interface{}{"alias": "/test"}},
			},
			expected: false,
		},
		{
			name: "document with empty primitive.A mcp",
			doc: map[string]interface{}{
				"userId": "u1",
				"mcp":    primitive.A{},
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := checker.IsEmpty(tt.doc)
			if result != tt.expected {
				t.Errorf("IsEmpty() = %v, want %v for doc %+v", result, tt.expected, tt.doc)
			}
		})
	}
}

// satisfiesMongoConditions applies the bson.M conditions returned by MongoEmptyConditions
// to an in-memory document using the same semantics MongoDB uses for the two operator
// forms we produce: {field: nil} (absent/null match) and {field.0: {$exists: false}}
// (empty-or-absent array match).
func satisfiesMongoConditions(doc map[string]interface{}, conditions bson.M) bool {
	for key, condVal := range conditions {
		if strings.Contains(key, ".") {
			parts := strings.SplitN(key, ".", 2)
			field, sub := parts[0], parts[1]
			if sub != "0" {
				continue
			}
			existsMap, ok := condVal.(bson.M)
			if !ok {
				return false
			}
			requirePresent, _ := existsMap["$exists"].(bool)
			hasFirstElem := false
			if v, ok := doc[field]; ok {
				switch arr := v.(type) {
				case []interface{}:
					hasFirstElem = len(arr) > 0
				case primitive.A:
					hasFirstElem = len(arr) > 0
				}
			}
			if requirePresent != hasFirstElem {
				return false
			}
		} else {
			if condVal != nil {
				continue
			}
			if v, exists := doc[key]; exists && v != nil {
				return false
			}
		}
	}
	return true
}

func TestDocumentEmptinessChecker_MongoEmptyConditions(t *testing.T) {
	checker := NewDocumentEmptinessChecker()
	conditions := checker.MongoEmptyConditions()

	t.Run("CoversAllRegisteredArrayFields", func(t *testing.T) {
		for fieldName := range registeredArrayFields {
			key := fieldName + ".0"
			val, ok := conditions[key]
			if !ok {
				t.Errorf("MongoEmptyConditions missing entry for array field %q (expected key %q)", fieldName, key)
				continue
			}
			asMap, ok := val.(bson.M)
			if !ok {
				t.Errorf("MongoEmptyConditions[%q]: want bson.M, got %T", key, val)
				continue
			}
			existsCond, ok := asMap["$exists"]
			if !ok || existsCond != false {
				t.Errorf("MongoEmptyConditions[%q]: want {$exists: false}, got %v", key, asMap)
			}
		}
	})

	t.Run("CoversAllLLMScalarFields", func(t *testing.T) {
		for _, llmField := range []string{"openai", "yandex", "claude", "qwen", "deepseek", "custom_llm", "perplexity"} {
			val, ok := conditions[llmField]
			if !ok {
				t.Errorf("MongoEmptyConditions missing LLM field %q", llmField)
				continue
			}
			if val != nil {
				t.Errorf("MongoEmptyConditions[%q]: want nil (match absent/null), got %v", llmField, val)
			}
		}
	})

	t.Run("ConsistentWithIsEmpty", func(t *testing.T) {
		cases := []struct {
			name string
			doc  map[string]interface{}
		}{
			{name: "metadata only", doc: map[string]interface{}{"userId": "u1"}},
			{name: "null llm field", doc: map[string]interface{}{"openai": nil}},
			{name: "empty mcp array", doc: map[string]interface{}{"mcp": []interface{}{}}},
			{name: "empty rpc array", doc: map[string]interface{}{"rpc": []interface{}{}}},
			{name: "primitive.A empty", doc: map[string]interface{}{"mcp": primitive.A{}}},
			{name: "mcp with item", doc: map[string]interface{}{"mcp": []interface{}{map[string]interface{}{"alias": "/a"}}}},
			{name: "rpc with item", doc: map[string]interface{}{"rpc": primitive.A{map[string]interface{}{"alias": "/a"}}}},
			{name: "non-null openai", doc: map[string]interface{}{"openai": map[string]interface{}{"apiKey": "k"}}},
			{name: "non-null claude", doc: map[string]interface{}{"claude": map[string]interface{}{"apiKey": "k"}}},
			{name: "mcp and rpc both empty", doc: map[string]interface{}{"mcp": []interface{}{}, "rpc": []interface{}{}}},
			{name: "llm field and mcp item", doc: map[string]interface{}{
				"openai": map[string]interface{}{"apiKey": "k"},
				"mcp":    []interface{}{map[string]interface{}{"alias": "/a"}},
			}},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				want := checker.IsEmpty(tc.doc)
				got := satisfiesMongoConditions(tc.doc, conditions)
				if got != want {
					t.Errorf("satisfiesMongoConditions=%v, IsEmpty=%v for doc %v", got, want, tc.doc)
				}
			})
		}
	})
}
