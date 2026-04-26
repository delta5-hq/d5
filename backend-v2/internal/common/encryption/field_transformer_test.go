package encryption

import (
	"reflect"
	"strings"
	"testing"
)

func setupTransformer() *FieldTransformer {
	kd, _ := NewKeyDerivation("test-secret-at-least-16-bytes")
	cipher := NewCipher()
	marker := NewMarker()
	service := NewService(kd, cipher, marker)
	serializer := NewSerializer()
	return NewFieldTransformer(service, serializer)
}

func TestFieldTransformer_EncryptDecryptField(t *testing.T) {
	ft := setupTransformer()

	tests := []struct {
		name  string
		doc   map[string]interface{}
		path  string
		value interface{}
	}{
		{
			name:  "encrypts top-level string field",
			doc:   map[string]interface{}{"apiKey": "secret-key"},
			path:  "apiKey",
			value: "secret-key",
		},
		{
			name:  "encrypts nested field",
			doc:   map[string]interface{}{"openai": map[string]interface{}{"apiKey": "sk-123"}},
			path:  "openai.apiKey",
			value: "sk-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			docCopy := copyMap(tt.doc)

			// Encrypt
			err := ft.EncryptField(docCopy, tt.path, false, nil)
			if err != nil {
				t.Fatalf("EncryptField failed: %v", err)
			}

			// Get encrypted value
			encryptedValue := getNestedValue(docCopy, tt.path)
			if encryptedValue == tt.value {
				t.Error("value should be encrypted")
			}

			// Decrypt
			err = ft.DecryptField(docCopy, tt.path, false, nil)
			if err != nil {
				t.Fatalf("DecryptField failed: %v", err)
			}

			// Verify decrypted value
			decryptedValue := getNestedValue(docCopy, tt.path)
			if !reflect.DeepEqual(decryptedValue, tt.value) {
				t.Errorf("decrypted = %v, want %v", decryptedValue, tt.value)
			}
		})
	}
}

func TestFieldTransformer_SerializedField(t *testing.T) {
	ft := setupTransformer()

	doc := map[string]interface{}{
		"headers": map[string]string{
			"Authorization": "Bearer token",
			"Content-Type":  "application/json",
		},
	}

	// Encrypt with serialization
	err := ft.EncryptField(doc, "headers", true, nil)
	if err != nil {
		t.Fatalf("EncryptField failed: %v", err)
	}

	encryptedHeaders, ok := doc["headers"].(string)
	if !ok {
		t.Fatal("expected headers to be encrypted string")
	}
	if !strings.Contains(encryptedHeaders, "__encrypted__") {
		t.Error("expected encrypted marker")
	}

	// Decrypt with deserialization
	err = ft.DecryptField(doc, "headers", true, nil)
	if err != nil {
		t.Fatalf("DecryptField failed: %v", err)
	}

	decryptedHeaders, ok := doc["headers"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected headers to be deserialized map, got %T", doc["headers"])
	}

	if decryptedHeaders["Authorization"] != "Bearer token" {
		t.Errorf("Authorization = %v, want Bearer token", decryptedHeaders["Authorization"])
	}
}

func TestFieldTransformer_NonExistentPath(t *testing.T) {
	ft := setupTransformer()

	doc := map[string]interface{}{"key": "value"}

	// Should not error on non-existent path
	err := ft.EncryptField(doc, "nonexistent.path", false, nil)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	// Doc should be unchanged
	if doc["key"] != "value" {
		t.Error("document was modified")
	}
}

func TestFieldTransformer_EncryptDecryptArrayFields(t *testing.T) {
	ft := setupTransformer()

	doc := map[string]interface{}{
		"rpc": []interface{}{
			map[string]interface{}{
				"alias":      "/ssh1",
				"privateKey": "-----BEGIN RSA PRIVATE KEY-----",
				"host":       "example.com",
			},
			map[string]interface{}{
				"alias":      "/ssh2",
				"privateKey": "-----BEGIN RSA PRIVATE KEY 2-----",
				"host":       "example2.com",
			},
		},
	}

	configs := []FieldConfig{
		{Path: "privateKey", Serialize: false},
	}

	// Encrypt array fields
	err := ft.EncryptArrayFields(doc, "rpc", configs, nil)
	if err != nil {
		t.Fatalf("EncryptArrayFields failed: %v", err)
	}

	// Verify encryption
	rpcArray := doc["rpc"].([]interface{})
	item1 := rpcArray[0].(map[string]interface{})
	privateKey1, ok := item1["privateKey"].(string)
	if !ok || !strings.Contains(privateKey1, "__encrypted__") {
		t.Error("privateKey should be encrypted")
	}

	// Host should not be encrypted
	if item1["host"] != "example.com" {
		t.Error("host should not be encrypted")
	}

	// Decrypt array fields
	err = ft.DecryptArrayFields(doc, "rpc", configs, nil)
	if err != nil {
		t.Fatalf("DecryptArrayFields failed: %v", err)
	}

	// Verify decryption
	item1Decrypted := rpcArray[0].(map[string]interface{})
	if item1Decrypted["privateKey"] != "-----BEGIN RSA PRIVATE KEY-----" {
		t.Errorf("privateKey = %v, want original", item1Decrypted["privateKey"])
	}
}

func TestFieldTransformer_ArrayWithSerializedFields(t *testing.T) {
	ft := setupTransformer()

	doc := map[string]interface{}{
		"mcp": []interface{}{
			map[string]interface{}{
				"alias": "/tool1",
				"headers": map[string]string{
					"Authorization": "Bearer secret",
				},
			},
		},
	}

	configs := []FieldConfig{
		{Path: "headers", Serialize: true},
	}

	// Encrypt
	err := ft.EncryptArrayFields(doc, "mcp", configs, nil)
	if err != nil {
		t.Fatalf("EncryptArrayFields failed: %v", err)
	}

	// Decrypt
	err = ft.DecryptArrayFields(doc, "mcp", configs, nil)
	if err != nil {
		t.Fatalf("DecryptArrayFields failed: %v", err)
	}

	// Verify
	mcpArray := doc["mcp"].([]interface{})
	item := mcpArray[0].(map[string]interface{})
	headers, ok := item["headers"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected headers to be map, got %T", item["headers"])
	}
	if headers["Authorization"] != "Bearer secret" {
		t.Errorf("Authorization = %v, want Bearer secret", headers["Authorization"])
	}
}

// Helper functions

func copyMap(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range m {
		if subMap, ok := v.(map[string]interface{}); ok {
			result[k] = copyMap(subMap)
		} else {
			result[k] = v
		}
	}
	return result
}

func getNestedValue(m map[string]interface{}, path string) interface{} {
	parts := strings.Split(path, ".")
	current := m

	for i, part := range parts {
		if i == len(parts)-1 {
			return current[part]
		}

		next, ok := current[part].(map[string]interface{})
		if !ok {
			return nil
		}
		current = next
	}

	return nil
}
