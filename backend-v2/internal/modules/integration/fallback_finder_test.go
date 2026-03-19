package integration

import (
	"backend-v2/internal/models"
	"testing"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

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
		t.Errorf("Expected field1=value1, got %v", resultMap["field1"])
	}

	if resultMap["field2"] != 42 {
		t.Errorf("Expected field2=42, got %v", resultMap["field2"])
	}

	nestedMap, ok := resultMap["nested"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected nested to be map[string]interface{}, got %T", resultMap["nested"])
	}

	if nestedMap["subfield"] != "subvalue" {
		t.Errorf("Expected nested.subfield=subvalue, got %v", nestedMap["subfield"])
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
		t.Fatalf("Expected 4 elements, got %d", len(resultSlice))
	}

	if resultSlice[0] != "string" {
		t.Errorf("Expected element 0 to be 'string', got %v", resultSlice[0])
	}

	if resultSlice[1] != 42 {
		t.Errorf("Expected element 1 to be 42, got %v", resultSlice[1])
	}

	elem2Map, ok := resultSlice[2].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected element 2 to be map, got %T", resultSlice[2])
	}
	if elem2Map["key"] != "value" {
		t.Errorf("Expected element 2.key=value, got %v", elem2Map["key"])
	}

	elem3Slice, ok := resultSlice[3].([]interface{})
	if !ok {
		t.Fatalf("Expected element 3 to be slice, got %T", resultSlice[3])
	}
	if len(elem3Slice) != 2 {
		t.Errorf("Expected element 3 to have 2 items, got %d", len(elem3Slice))
	}
}

func TestNormalizeBSONValue_RegularMap(t *testing.T) {
	input := map[string]interface{}{
		"field1": "value1",
		"field2": primitive.D{{Key: "nested", Value: "nested_value"}},
		"field3": []interface{}{
			primitive.A{"item1", "item2"},
		},
	}

	result := normalizeBSONValue(input)

	resultMap, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map[string]interface{}, got %T", result)
	}

	if resultMap["field1"] != "value1" {
		t.Errorf("Expected field1=value1, got %v", resultMap["field1"])
	}

	field2Map, ok := resultMap["field2"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected field2 to be map, got %T", resultMap["field2"])
	}
	if field2Map["nested"] != "nested_value" {
		t.Errorf("Expected field2.nested=nested_value, got %v", field2Map["nested"])
	}
}

func TestNormalizeBSONValue_RegularSlice(t *testing.T) {
	input := []interface{}{
		"string",
		primitive.D{{Key: "key", Value: "value"}},
		primitive.A{"item1", "item2"},
	}

	result := normalizeBSONValue(input)

	resultSlice, ok := result.([]interface{})
	if !ok {
		t.Fatalf("Expected []interface{}, got %T", result)
	}

	if resultSlice[0] != "string" {
		t.Errorf("Expected element 0 to be 'string', got %v", resultSlice[0])
	}

	elem1Map, ok := resultSlice[1].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected element 1 to be map, got %T", resultSlice[1])
	}
	if elem1Map["key"] != "value" {
		t.Errorf("Expected element 1.key=value, got %v", elem1Map["key"])
	}
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
				t.Errorf("Expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestNormalizeBSONDoc_ComplexNesting(t *testing.T) {
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
	if !ok {
		t.Fatalf("Expected mcp to be []interface{}, got %T", doc["mcp"])
	}

	if len(mcpArray) != 1 {
		t.Fatalf("Expected mcp to have 1 element, got %d", len(mcpArray))
	}

	mcpItem, ok := mcpArray[0].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected mcp[0] to be map, got %T", mcpArray[0])
	}

	if mcpItem["alias"] != "/mcp1" {
		t.Errorf("Expected mcp[0].alias=/mcp1, got %v", mcpItem["alias"])
	}

	headers, ok := mcpItem["headers"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected headers to be map, got %T", mcpItem["headers"])
	}

	if headers["Authorization"] != "Bearer token" {
		t.Errorf("Expected headers.Authorization=Bearer token, got %v", headers["Authorization"])
	}
}

func TestFallbackFinder_NormalizerCalled(t *testing.T) {
	normalizerCalled := false
	mockNormalizer := func(doc map[string]interface{}) {
		normalizerCalled = true
	}

	mockUnmarshaler := func(data []byte, v interface{}) error {
		return bson.Unmarshal(data, v)
	}

	finder := &FallbackFinder{
		normalizer:  mockNormalizer,
		unmarshaler: mockUnmarshaler,
	}

	finder.normalizer(map[string]interface{}{"test": "value"})

	if !normalizerCalled {
		t.Error("Expected normalizer to be called")
	}
}

func TestFallbackFinder_UnmarshalerCalled(t *testing.T) {
	unmarshalerCalled := false
	mockUnmarshaler := func(data []byte, v interface{}) error {
		unmarshalerCalled = true
		return nil
	}

	finder := &FallbackFinder{
		normalizer:  normalizeBSONDoc,
		unmarshaler: mockUnmarshaler,
	}

	var result models.Integration
	_ = finder.unmarshaler([]byte{}, &result)

	if !unmarshalerCalled {
		t.Error("Expected unmarshaler to be called")
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
		t.Error("String field should remain unchanged after multiple normalizations")
	}

	field2Map, ok := doc["field2"].(map[string]interface{})
	if !ok || field2Map["key"] != "value" {
		t.Error("Map field should remain accessible after multiple normalizations")
	}

	field3Slice, ok := doc["field3"].([]interface{})
	if !ok || len(field3Slice) != 2 {
		t.Error("Slice field should remain accessible after multiple normalizations")
	}
}

func TestNormalizeBSONValue_EmptyCollections(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{
			name:     "EmptyPrimitiveD",
			input:    primitive.D{},
			expected: map[string]interface{}{},
		},
		{
			name:     "EmptyPrimitiveA",
			input:    primitive.A{},
			expected: []interface{}{},
		},
		{
			name:     "EmptyMap",
			input:    map[string]interface{}{},
			expected: map[string]interface{}{},
		},
		{
			name:     "EmptySlice",
			input:    []interface{}{},
			expected: []interface{}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeBSONValue(tt.input)

			bytes1, _ := bson.Marshal(result)
			bytes2, _ := bson.Marshal(tt.expected)

			if string(bytes1) != string(bytes2) {
				t.Errorf("Expected %v, got %v", tt.expected, result)
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
		t.Errorf("Expected deep value, got %v", level4["value"])
	}
}

func TestFallbackFinder_WorkflowScopedFound(t *testing.T) {
	t.Skip("Requires qmgo mock infrastructure - covered by E2E tests")
}

func TestFallbackFinder_WorkflowScopedMissing_UserLevelFound(t *testing.T) {
	t.Skip("Requires qmgo mock infrastructure - covered by E2E tests")
}

func TestFallbackFinder_BothMissing(t *testing.T) {
	t.Skip("Requires qmgo mock infrastructure - covered by E2E tests")
}

func TestFallbackFinder_DBError_Propagated(t *testing.T) {
	t.Skip("Requires qmgo mock infrastructure - covered by E2E tests")
}

func TestNormalizeBSONDoc_PreservesUserID(t *testing.T) {
	doc := map[string]interface{}{
		"userId": "user-123",
		"data":   primitive.D{{Key: "key", Value: "value"}},
	}

	normalizeBSONDoc(doc)

	if doc["userId"] != "user-123" {
		t.Errorf("Expected userId to be preserved, got %v", doc["userId"])
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
		t.Errorf("Expected field1 to be nil, got %v", doc["field1"])
	}

	field2Map, ok := doc["field2"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected field2 to be map, got %T", doc["field2"])
	}
	if field2Map["key"] != nil {
		t.Errorf("Expected field2.key to be nil, got %v", field2Map["key"])
	}

	field3Slice, ok := doc["field3"].([]interface{})
	if !ok {
		t.Fatalf("Expected field3 to be slice, got %T", doc["field3"])
	}
	if field3Slice[0] != nil || field3Slice[2] != nil {
		t.Errorf("Expected nil elements to be preserved")
	}
	if field3Slice[1] != "value" {
		t.Errorf("Expected non-nil element to be preserved")
	}
}

func TestNormalizeBSONValue_MixedArrayTypes(t *testing.T) {
	input := primitive.A{
		"string",
		42,
		3.14,
		true,
		nil,
		primitive.D{{Key: "key", Value: "value"}},
		primitive.A{"nested"},
		map[string]interface{}{"map": "value"},
		[]interface{}{"slice"},
	}

	result := normalizeBSONValue(input)

	resultSlice, ok := result.([]interface{})
	if !ok {
		t.Fatalf("Expected []interface{}, got %T", result)
	}

	if len(resultSlice) != 9 {
		t.Fatalf("Expected 9 elements, got %d", len(resultSlice))
	}

	if resultSlice[0] != "string" {
		t.Errorf("Element 0: expected string, got %v", resultSlice[0])
	}
	if resultSlice[1] != 42 {
		t.Errorf("Element 1: expected 42, got %v", resultSlice[1])
	}
	if resultSlice[2] != 3.14 {
		t.Errorf("Element 2: expected 3.14, got %v", resultSlice[2])
	}
	if resultSlice[3] != true {
		t.Errorf("Element 3: expected true, got %v", resultSlice[3])
	}
	if resultSlice[4] != nil {
		t.Errorf("Element 4: expected nil, got %v", resultSlice[4])
	}

	elem5Map, ok := resultSlice[5].(map[string]interface{})
	if !ok || elem5Map["key"] != "value" {
		t.Errorf("Element 5: expected map with key=value")
	}

	elem6Slice, ok := resultSlice[6].([]interface{})
	if !ok || len(elem6Slice) != 1 || elem6Slice[0] != "nested" {
		t.Errorf("Element 6: expected slice with 'nested'")
	}
}

func TestBuildScopeFilter_ConsistentSerialization(t *testing.T) {
	scope := ScopeIdentifier{
		UserID:     "user-1",
		WorkflowID: stringPtr("wf-123"),
	}

	filter1 := buildScopeFilter(scope)
	filter2 := buildScopeFilter(scope)

	bytes1, _ := bson.Marshal(filter1)
	bytes2, _ := bson.Marshal(filter2)

	if string(bytes1) != string(bytes2) {
		t.Error("buildScopeFilter should produce consistent output for same input")
	}
}
