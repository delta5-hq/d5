package integration

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type capturedCall struct {
	filter bson.M
}

type sequencedQuerier struct {
	responses []querierResponse
	callIndex int
	captured  []capturedCall
}

type querierResponse struct {
	doc map[string]interface{}
	err error
}

func (s *sequencedQuerier) FindOne(_ context.Context, filter bson.M) (map[string]interface{}, error) {
	s.captured = append(s.captured, capturedCall{filter: filter})
	if s.callIndex >= len(s.responses) {
		return nil, qmgo.ErrNoSuchDocuments
	}
	r := s.responses[s.callIndex]
	s.callIndex++
	return r.doc, r.err
}

func (s *sequencedQuerier) callCount() int      { return len(s.captured) }
func (s *sequencedQuerier) callAt(i int) bson.M { return s.captured[i].filter }

func mustEncryptor(t *testing.T) *DocumentEncryptor {
	t.Helper()
	enc, err := NewDocumentEncryptor()
	if err != nil {
		t.Fatalf("NewDocumentEncryptor: %v", err)
	}
	return enc
}

func newTestFinder(t *testing.T, querier ScopeQuerier) *FallbackFinder {
	t.Helper()
	return &FallbackFinder{
		querier:     querier,
		encryptor:   mustEncryptor(t),
		normalizer:  normalizeBSONDoc,
		unmarshaler: bson.Unmarshal,
	}
}

func plainUserDoc(userID string) map[string]interface{} {
	return map[string]interface{}{"userId": userID}
}

func plainWorkflowDoc(userID, workflowID string) map[string]interface{} {
	return map[string]interface{}{"userId": userID, "workflowId": workflowID}
}

func TestFallbackFinder_FindWithFallback(t *testing.T) {
	wfID := func(s string) *string { return &s }

	errDB := errors.New("connection refused")

	tests := []struct {
		name          string
		scope         ScopeIdentifier
		responses     []querierResponse
		wantErr       bool
		wantSentinel  error // if non-nil, checked with errors.Is
		wantCallCount int
		// wantFilters: each element is nil (workflowId=nil) or string (workflowId=that value)
		wantFilters []interface{}
	}{
		{
			name:          "workflow scope found: returns doc, no fallback",
			scope:         ScopeIdentifier{UserID: "u1", WorkflowID: wfID("wf-a")},
			responses:     []querierResponse{{doc: plainWorkflowDoc("u1", "wf-a")}},
			wantCallCount: 1,
			wantFilters:   []interface{}{"wf-a"},
		},
		{
			name:  "workflow scope missing: falls back to user scope",
			scope: ScopeIdentifier{UserID: "u1", WorkflowID: wfID("wf-b")},
			responses: []querierResponse{
				{err: qmgo.ErrNoSuchDocuments},
				{doc: plainUserDoc("u1")},
			},
			wantCallCount: 2,
			wantFilters:   []interface{}{"wf-b", nil},
		},
		{
			name:  "both scopes missing: returns ErrNoSuchDocuments",
			scope: ScopeIdentifier{UserID: "u1", WorkflowID: wfID("wf-c")},
			responses: []querierResponse{
				{err: qmgo.ErrNoSuchDocuments},
				{err: qmgo.ErrNoSuchDocuments},
			},
			wantErr:       true,
			wantSentinel:  qmgo.ErrNoSuchDocuments,
			wantCallCount: 2,
			wantFilters:   []interface{}{"wf-c", nil},
		},
		{
			name:          "non-sentinel DB error at workflow scope: propagates without fallback",
			scope:         ScopeIdentifier{UserID: "u1", WorkflowID: wfID("wf-d")},
			responses:     []querierResponse{{err: errDB}},
			wantErr:       true,
			wantSentinel:  errDB,
			wantCallCount: 1,
			wantFilters:   []interface{}{"wf-d"},
		},
		{
			name:  "non-sentinel DB error at user-scope fallback: propagates",
			scope: ScopeIdentifier{UserID: "u1", WorkflowID: wfID("wf-e")},
			responses: []querierResponse{
				{err: qmgo.ErrNoSuchDocuments},
				{err: errDB},
			},
			wantErr:       true,
			wantSentinel:  errDB,
			wantCallCount: 2,
			wantFilters:   []interface{}{"wf-e", nil},
		},
		{
			name:          "user scope (nil workflowId): issues exactly one query with nil workflowId filter",
			scope:         ScopeIdentifier{UserID: "u2", WorkflowID: nil},
			responses:     []querierResponse{{doc: plainUserDoc("u2")}},
			wantCallCount: 1,
			wantFilters:   []interface{}{nil},
		},
		{
			name:          "user scope (nil workflowId): doc missing returns ErrNoSuchDocuments",
			scope:         ScopeIdentifier{UserID: "u3", WorkflowID: nil},
			responses:     []querierResponse{{err: qmgo.ErrNoSuchDocuments}},
			wantErr:       true,
			wantSentinel:  qmgo.ErrNoSuchDocuments,
			wantCallCount: 1,
			wantFilters:   []interface{}{nil},
		},
		{
			name:          "user scope (nil workflowId): DB error propagates",
			scope:         ScopeIdentifier{UserID: "u4", WorkflowID: nil},
			responses:     []querierResponse{{err: errDB}},
			wantErr:       true,
			wantSentinel:  errDB,
			wantCallCount: 1,
			wantFilters:   []interface{}{nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			querier := &sequencedQuerier{responses: tt.responses}
			finder := newTestFinder(t, querier)

			_, err := finder.findWithFallback(context.Background(), tt.scope)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantSentinel != nil && !errors.Is(err, tt.wantSentinel) {
					t.Errorf("error sentinel mismatch: want %v, got %v", tt.wantSentinel, err)
				}
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if querier.callCount() != tt.wantCallCount {
				t.Errorf("DB call count: want %d, got %d", tt.wantCallCount, querier.callCount())
			}

			for i, want := range tt.wantFilters {
				if i >= querier.callCount() {
					break
				}
				got := querier.callAt(i)["workflowId"]
				gotPtr, _ := got.(*string)
				if want == nil {
					if gotPtr != nil {
						t.Errorf("call[%d] workflowId: want nil, got %v", i, got)
					}
				} else {
					wantStr := want.(string)
					if gotPtr == nil || *gotPtr != wantStr {
						t.Errorf("call[%d] workflowId: want %q, got %v", i, wantStr, got)
					}
				}
			}
		})
	}
}

func TestFallbackFinder_FindByScope_PipelineIntegrity(t *testing.T) {
	rawDoc := map[string]interface{}{
		"userId": "user-pipeline",
		"lang":   "ru",
		"mcp": primitive.A{
			primitive.D{
				{Key: "alias", Value: "/echo"},
				{Key: "transport", Value: "stdio"},
				{Key: "toolName", Value: "my-tool"},
			},
		},
	}

	querier := &sequencedQuerier{
		responses: []querierResponse{{doc: rawDoc}},
	}
	finder := newTestFinder(t, querier)

	result, err := finder.findWithFallback(context.Background(), ScopeIdentifier{
		UserID:     "user-pipeline",
		WorkflowID: nil,
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.UserID != "user-pipeline" {
		t.Errorf("UserID: want user-pipeline, got %q", result.UserID)
	}
	if result.Lang != "ru" {
		t.Errorf("Lang: want ru, got %q", result.Lang)
	}
	if len(result.MCP) != 1 {
		t.Fatalf("MCP len: want 1, got %d", len(result.MCP))
	}
	if result.MCP[0].Alias != "/echo" {
		t.Errorf("MCP[0].Alias: want /echo, got %q", result.MCP[0].Alias)
	}
}

func TestNormalizeBSONValue_PrimitiveD(t *testing.T) {
	input := primitive.D{
		{Key: "field1", Value: "value1"},
		{Key: "field2", Value: 42},
		{Key: "nested", Value: primitive.D{
			{Key: "subfield", Value: "subvalue"},
		}},
	}

	result := normalizeBSONValue(input)

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map[string]interface{}, got %T", result)
	}
	if resultMap["field1"] != "value1" {
		t.Errorf("field1: want value1, got %v", resultMap["field1"])
	}
	if resultMap["field2"] != 42 {
		t.Errorf("field2: want 42, got %v", resultMap["field2"])
	}

	nestedMap, ok := resultMap["nested"].(map[string]interface{})
	if !ok {
		t.Fatalf("nested: want map[string]interface{}, got %T", resultMap["nested"])
	}
	if nestedMap["subfield"] != "subvalue" {
		t.Errorf("nested.subfield: want subvalue, got %v", nestedMap["subfield"])
	}
}

func TestNormalizeBSONValue_PrimitiveA(t *testing.T) {
	input := primitive.A{
		"string",
		42,
		primitive.D{{Key: "key", Value: "value"}},
		primitive.A{"nested1", "nested2"},
	}

	result := normalizeBSONValue(input)

	resultSlice, ok := result.([]interface{})
	if !ok {
		t.Fatalf("Expected []interface{}, got %T", result)
	}
	if len(resultSlice) != 4 {
		t.Fatalf("length: want 4, got %d", len(resultSlice))
	}
	if resultSlice[0] != "string" {
		t.Errorf("element 0: want string, got %v", resultSlice[0])
	}
	if resultSlice[1] != 42 {
		t.Errorf("element 1: want 42, got %v", resultSlice[1])
	}

	elem2Map, ok := resultSlice[2].(map[string]interface{})
	if !ok {
		t.Fatalf("element 2: want map, got %T", resultSlice[2])
	}
	if elem2Map["key"] != "value" {
		t.Errorf("element 2 key: want value, got %v", elem2Map["key"])
	}

	elem3Slice, ok := resultSlice[3].([]interface{})
	if !ok || len(elem3Slice) != 2 {
		t.Errorf("element 3: want []interface{} with 2 items")
	}
}

func TestNormalizeBSONValue_NativeGoTypes(t *testing.T) {
	t.Run("MapWithNestedPrimitiveD", func(t *testing.T) {
		input := map[string]interface{}{
			"scalar": "value1",
			"nested": primitive.D{{Key: "k", Value: "v"}},
		}
		result := normalizeBSONValue(input)
		m, ok := result.(map[string]interface{})
		if !ok {
			t.Fatalf("want map, got %T", result)
		}
		if m["scalar"] != "value1" {
			t.Errorf("scalar: want value1, got %v", m["scalar"])
		}
		nested, ok := m["nested"].(map[string]interface{})
		if !ok || nested["k"] != "v" {
			t.Errorf("nested: want map with k=v, got %v", m["nested"])
		}
	})

	t.Run("SliceWithNestedPrimitiveA", func(t *testing.T) {
		input := []interface{}{
			"first",
			primitive.A{"nested"},
		}
		result := normalizeBSONValue(input)
		s, ok := result.([]interface{})
		if !ok || len(s) != 2 {
			t.Fatalf("want []interface{} len 2, got %T %v", result, result)
		}
		if s[0] != "first" {
			t.Errorf("element 0: want first, got %v", s[0])
		}
		inner, ok := s[1].([]interface{})
		if !ok || len(inner) != 1 || inner[0] != "nested" {
			t.Errorf("element 1: want [nested], got %v", s[1])
		}
	})
}

func TestNormalizeBSONValue_ScalarTypes(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{name: "String", input: "test", expected: "test"},
		{name: "Int", input: 42, expected: 42},
		{name: "Float", input: 3.14, expected: 3.14},
		{name: "Bool", input: true, expected: true},
		{name: "Nil", input: nil, expected: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeBSONValue(tt.input)
			if result != tt.expected {
				t.Errorf("want %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestNormalizeBSONValue_EmptyCollections(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{name: "EmptyPrimitiveD", input: primitive.D{}, expected: map[string]interface{}{}},
		{name: "EmptyPrimitiveA", input: primitive.A{}, expected: []interface{}{}},
		{name: "EmptyMap", input: map[string]interface{}{}, expected: map[string]interface{}{}},
		{name: "EmptySlice", input: []interface{}{}, expected: []interface{}{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeBSONValue(tt.input)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("want %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestNormalizeBSONValue_DeeplyNested(t *testing.T) {
	input := primitive.D{
		{Key: "level1", Value: primitive.D{
			{Key: "level2", Value: primitive.D{
				{Key: "level3", Value: primitive.D{
					{Key: "level4", Value: primitive.D{
						{Key: "value", Value: "deep"},
					}},
				}},
			}},
		}},
	}

	result := normalizeBSONValue(input)

	level1, ok := result.(map[string]interface{})["level1"].(map[string]interface{})
	if !ok {
		t.Fatal("level1 not found or wrong type")
	}
	level2, ok := level1["level2"].(map[string]interface{})
	if !ok {
		t.Fatal("level2 not found or wrong type")
	}
	level3, ok := level2["level3"].(map[string]interface{})
	if !ok {
		t.Fatal("level3 not found or wrong type")
	}
	level4, ok := level3["level4"].(map[string]interface{})
	if !ok {
		t.Fatal("level4 not found or wrong type")
	}
	if level4["value"] != "deep" {
		t.Errorf("deep value: want deep, got %v", level4["value"])
	}
}

func TestNormalizeBSONValue_MixedArrayTypes(t *testing.T) {
	input := primitive.A{
		"string", 42, 3.14, true, nil,
		primitive.D{{Key: "key", Value: "value"}},
		primitive.A{"nested"},
		map[string]interface{}{"map": "value"},
		[]interface{}{"slice"},
	}

	result := normalizeBSONValue(input)

	resultSlice, ok := result.([]interface{})
	if !ok || len(resultSlice) != 9 {
		t.Fatalf("want []interface{} len 9, got %T len %d", result, len(resultSlice))
	}
	if resultSlice[0] != "string" || resultSlice[1] != 42 ||
		resultSlice[2] != 3.14 || resultSlice[3] != true || resultSlice[4] != nil {
		t.Errorf("scalar elements mismatch: %v", resultSlice[:5])
	}

	elem5, ok := resultSlice[5].(map[string]interface{})
	if !ok || elem5["key"] != "value" {
		t.Errorf("element 5: want map with key=value, got %v", resultSlice[5])
	}
	elem6, ok := resultSlice[6].([]interface{})
	if !ok || len(elem6) != 1 || elem6[0] != "nested" {
		t.Errorf("element 6: want [nested], got %v", resultSlice[6])
	}
}

func TestNormalizeBSONDoc_Idempotent(t *testing.T) {
	doc := map[string]interface{}{
		"field1": "value1",
		"field2": map[string]interface{}{"key": "value"},
		"field3": []interface{}{"item1", "item2"},
	}

	normalizeBSONDoc(doc)
	normalizeBSONDoc(doc)

	if doc["field1"] != "value1" {
		t.Error("string field changed after second normalization")
	}
	field2, ok := doc["field2"].(map[string]interface{})
	if !ok || field2["key"] != "value" {
		t.Error("map field inaccessible after second normalization")
	}
	field3, ok := doc["field3"].([]interface{})
	if !ok || len(field3) != 2 {
		t.Error("slice field inaccessible after second normalization")
	}
}

func TestNormalizeBSONDoc_HandlesNilValues(t *testing.T) {
	doc := map[string]interface{}{
		"field1": nil,
		"field2": primitive.D{{Key: "key", Value: nil}},
		"field3": primitive.A{nil, "value", nil},
	}

	normalizeBSONDoc(doc)

	if doc["field1"] != nil {
		t.Errorf("field1: want nil, got %v", doc["field1"])
	}
	field2, ok := doc["field2"].(map[string]interface{})
	if !ok {
		t.Fatalf("field2: want map, got %T", doc["field2"])
	}
	if field2["key"] != nil {
		t.Errorf("field2.key: want nil, got %v", field2["key"])
	}
	field3, ok := doc["field3"].([]interface{})
	if !ok {
		t.Fatalf("field3: want slice, got %T", doc["field3"])
	}
	if field3[0] != nil || field3[2] != nil || field3[1] != "value" {
		t.Errorf("field3 elements: want [nil, value, nil], got %v", field3)
	}
}

func TestNormalizeBSONDoc_IntegrationDocShape(t *testing.T) {
	doc := map[string]interface{}{
		"userId": "user-1",
		"mcp": primitive.A{
			primitive.D{
				{Key: "alias", Value: "/mcp1"},
				{Key: "headers", Value: primitive.D{
					{Key: "Authorization", Value: "Bearer token"},
				}},
				{Key: "env", Value: primitive.D{
					{Key: "API_KEY", Value: "secret"},
				}},
			},
		},
		"rpc": primitive.A{
			primitive.D{
				{Key: "alias", Value: "/ssh1"},
				{Key: "protocol", Value: "ssh"},
			},
		},
	}

	normalizeBSONDoc(doc)

	mcpArray, ok := doc["mcp"].([]interface{})
	if !ok || len(mcpArray) != 1 {
		t.Fatalf("mcp: want []interface{} len 1, got %T len %d", doc["mcp"], func() int {
			if a, ok2 := doc["mcp"].([]interface{}); ok2 {
				return len(a)
			}
			return -1
		}())
	}
	mcpItem, ok := mcpArray[0].(map[string]interface{})
	if !ok {
		t.Fatalf("mcp[0]: want map, got %T", mcpArray[0])
	}
	if mcpItem["alias"] != "/mcp1" {
		t.Errorf("mcp[0].alias: want /mcp1, got %v", mcpItem["alias"])
	}
	headers, ok := mcpItem["headers"].(map[string]interface{})
	if !ok || headers["Authorization"] != "Bearer token" {
		t.Errorf("mcp[0].headers: want Authorization=Bearer token, got %v", mcpItem["headers"])
	}

	rpcArray, ok := doc["rpc"].([]interface{})
	if !ok || len(rpcArray) != 1 {
		t.Fatalf("rpc: want []interface{} len 1, got %T", doc["rpc"])
	}
	rpcItem, ok := rpcArray[0].(map[string]interface{})
	if !ok || rpcItem["alias"] != "/ssh1" {
		t.Errorf("rpc[0].alias: want /ssh1, got %v", rpcItem)
	}
}

func TestNormalizeBSONDoc_UserIDPreservedAfterConversions(t *testing.T) {
	doc := map[string]interface{}{
		"userId": "user-preserved",
		"nested": primitive.D{{Key: "k", Value: "v"}},
	}

	normalizeBSONDoc(doc)

	if doc["userId"] != "user-preserved" {
		t.Errorf("userId: want user-preserved, got %v", doc["userId"])
	}
}
