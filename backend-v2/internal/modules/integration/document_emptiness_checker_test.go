package integration

import (
	"testing"

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
