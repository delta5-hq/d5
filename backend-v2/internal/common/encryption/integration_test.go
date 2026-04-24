package encryption

import (
	"encoding/hex"
	"strings"
	"testing"
)

// TestEncryptionIntegration_EndToEnd validates complete encryption pipeline.
func TestEncryptionIntegration_EndToEnd(t *testing.T) {
	service, err := GetService()
	if err != nil {
		t.Fatalf("GetService failed: %v", err)
	}

	serializer := NewSerializer()
	transformer := NewFieldTransformer(service, serializer)

	tests := []struct {
		name     string
		document map[string]interface{}
		fields   []string
		arrays   map[string][]FieldConfig
	}{
		{
			name: "complex document with all field types",
			document: map[string]interface{}{
				"userId": "user-123",
				"simple": "plaintext",
				"nested": map[string]interface{}{
					"level1": map[string]interface{}{
						"level2": map[string]interface{}{
							"secret": "deep-secret",
						},
					},
				},
				"array": []interface{}{
					map[string]interface{}{
						"id":     "item1",
						"secret": "array-secret-1",
						"object": map[string]string{
							"key": "value",
						},
					},
					map[string]interface{}{
						"id":     "item2",
						"secret": "array-secret-2",
					},
				},
			},
			fields: []string{"nested.level1.level2.secret"},
			arrays: map[string][]FieldConfig{
				"array": {
					{Path: "secret", Serialize: false},
					{Path: "object", Serialize: true},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Encrypt
			for _, field := range tt.fields {
				if err := transformer.EncryptField(tt.document, field, false, nil); err != nil {
					t.Fatalf("EncryptField failed: %v", err)
				}
			}

			for arrayName, configs := range tt.arrays {
				if err := transformer.EncryptArrayFields(tt.document, arrayName, configs, nil); err != nil {
					t.Fatalf("EncryptArrayFields failed: %v", err)
				}
			}

			// Verify non-secret fields unchanged
			if tt.document["userId"] != "user-123" {
				t.Error("non-secret field should remain unchanged")
			}

			// Decrypt
			for _, field := range tt.fields {
				if err := transformer.DecryptField(tt.document, field, false, nil); err != nil {
					t.Fatalf("DecryptField failed: %v", err)
				}
			}

			for arrayName, configs := range tt.arrays {
				if err := transformer.DecryptArrayFields(tt.document, arrayName, configs, nil); err != nil {
					t.Fatalf("DecryptArrayFields failed: %v", err)
				}
			}

			// Verify decryption
			nested := tt.document["nested"].(map[string]interface{})["level1"].(map[string]interface{})["level2"].(map[string]interface{})
			if nested["secret"] != "deep-secret" {
				t.Errorf("nested secret = %v, want deep-secret", nested["secret"])
			}
		})
	}
}

// TestEncryptionIntegration_ConcurrentAccess validates thread safety of singleton service.
func TestEncryptionIntegration_ConcurrentAccess(t *testing.T) {
	concurrency := 10
	done := make(chan bool, concurrency)

	for i := 0; i < concurrency; i++ {
		go func(id int) {
			defer func() { done <- true }()

			service, err := GetService()
			if err != nil {
				t.Errorf("goroutine %d: GetService failed: %v", id, err)
				return
			}

			plaintext := "concurrent-test"
			encrypted, err := service.Encrypt(plaintext, nil)
			if err != nil {
				t.Errorf("goroutine %d: Encrypt failed: %v", id, err)
				return
			}

			decrypted, err := service.Decrypt(encrypted, nil)
			if err != nil {
				t.Errorf("goroutine %d: Decrypt failed: %v", id, err)
				return
			}

			if decrypted != plaintext {
				t.Errorf("goroutine %d: decrypted = %v, want %v", id, decrypted, plaintext)
			}
		}(i)
	}

	for i := 0; i < concurrency; i++ {
		<-done
	}
}

// TestEncryptionIntegration_ServiceSingleton validates singleton behavior.
func TestEncryptionIntegration_ServiceSingleton(t *testing.T) {
	service1, err := GetService()
	if err != nil {
		t.Fatalf("first GetService failed: %v", err)
	}

	service2, err := GetService()
	if err != nil {
		t.Fatalf("second GetService failed: %v", err)
	}

	if service1 != service2 {
		t.Error("GetService should return same singleton instance")
	}

	// Reset and verify new instance
	ResetService()
	service3, err := GetService()
	if err != nil {
		t.Fatalf("third GetService failed: %v", err)
	}

	if service1 == service3 {
		t.Error("after ResetService, GetService should return new instance")
	}

	// Cleanup
	ResetService()
}

// TestEncryptionIntegration_LargeDataset validates performance with large documents.
func TestEncryptionIntegration_LargeDataset(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping large dataset test in short mode")
	}

	service, _ := GetService()
	serializer := NewSerializer()
	transformer := NewFieldTransformer(service, serializer)

	// Create document with 100 array items
	doc := map[string]interface{}{
		"items": make([]interface{}, 100),
	}

	for i := 0; i < 100; i++ {
		doc["items"].([]interface{})[i] = map[string]interface{}{
			"id":     i,
			"secret": strings.Repeat("x", 1000), // 1KB per secret
		}
	}

	configs := []FieldConfig{{Path: "secret", Serialize: false}}

	// Encrypt
	if err := transformer.EncryptArrayFields(doc, "items", configs, nil); err != nil {
		t.Fatalf("EncryptArrayFields failed: %v", err)
	}

	// Decrypt
	if err := transformer.DecryptArrayFields(doc, "items", configs, nil); err != nil {
		t.Fatalf("DecryptArrayFields failed: %v", err)
	}

	// Verify sample
	item := doc["items"].([]interface{})[50].(map[string]interface{})
	expected := strings.Repeat("x", 1000)
	if item["secret"] != expected {
		t.Error("large dataset decryption failed")
	}
}

// TestEncryptionIntegration_NodeJSInterop decrypts a value produced by Node.js fieldEncryption.js.
// Generated via:
//
//	secret = "test-jwt-secret-change-in-production"
//	iv = Buffer.from("0102030405060708090a0b0c0d0e0f10", "hex")
//	plaintext = "test-secret-value"
//	format: IV(16) || AuthTag(16) || Ciphertext → base64
func TestEncryptionIntegration_NodeJSInterop(t *testing.T) {
	keyHex := "22e43334aad10f8ad3055f597c9ddaed0c1f5f150c322e12e0ea2ef9afede5ac"
	nodeCiphertext := "AQIDBAUGBwgJCgsMDQ4PEFBsHnhLgfG1f9iDMIhbNeLcXnHvbJHiMCEs+1Lk8jPpSQ=="
	expectedPlaintext := "test-secret-value"

	key, err := hex.DecodeString(keyHex)
	if err != nil {
		t.Fatalf("hex decode key: %v", err)
	}

	c := NewCipher()
	decrypted, err := c.Decrypt(nodeCiphertext, key, nil)
	if err != nil {
		t.Fatalf("Go failed to decrypt Node.js ciphertext: %v", err)
	}

	if decrypted != expectedPlaintext {
		t.Errorf("decrypted = %q, want %q", decrypted, expectedPlaintext)
	}
}

// TestEncryptionIntegration_GoEncryptedFormat validates Go output matches Node.js wire format.
func TestEncryptionIntegration_GoEncryptedFormat(t *testing.T) {
	service, _ := GetService()

	tests := []struct {
		name  string
		value string
	}{
		{name: "ascii", value: "sk-openai-key-123456789"},
		{name: "unicode", value: "密钥-ключ-مفتاح"},
		{name: "json", value: `{"Authorization":"Bearer token"}`},
		{name: "ssh key", value: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := service.Encrypt(tt.value, nil)
			if err != nil {
				t.Fatalf("Encrypt: %v", err)
			}

			if !strings.HasPrefix(encrypted, "__encrypted__") {
				t.Error("missing __encrypted__ prefix")
			}

			decrypted, err := service.Decrypt(encrypted, nil)
			if err != nil {
				t.Fatalf("Decrypt: %v", err)
			}

			if decrypted != tt.value {
				t.Errorf("round trip failed: got %q, want %q", decrypted, tt.value)
			}
		})
	}
}
