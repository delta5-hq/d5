package integration

import (
	"strings"
	"testing"
)

func TestDocumentEncryptor_EncryptDecrypt(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	if err != nil {
		t.Fatalf("NewDocumentEncryptor failed: %v", err)
	}

	tests := []struct {
		name string
		doc  map[string]interface{}
	}{
		{
			name: "encrypts LLM API keys",
			doc: map[string]interface{}{
				"userId": "user-123",
				"openai": map[string]interface{}{
					"apiKey": "sk-openai-key",
					"model":  "gpt-4",
				},
				"claude": map[string]interface{}{
					"apiKey": "sk-claude-key",
					"model":  "claude-3",
				},
			},
		},
		{
			name: "encrypts RPC secrets",
			doc: map[string]interface{}{
				"userId": "user-123",
				"rpc": []interface{}{
					map[string]interface{}{
						"alias":      "/ssh1",
						"privateKey": "-----BEGIN RSA PRIVATE KEY-----",
						"passphrase": "secret-passphrase",
						"host":       "example.com",
						"headers": map[string]string{
							"Authorization": "Bearer token",
						},
					},
				},
			},
		},
		{
			name: "encrypts MCP secrets",
			doc: map[string]interface{}{
				"userId": "user-123",
				"mcp": []interface{}{
					map[string]interface{}{
						"alias": "/tool1",
						"env": map[string]string{
							"API_KEY": "secret-key",
						},
						"headers": map[string]string{
							"X-Custom": "value",
						},
					},
				},
			},
		},
		{
			name: "handles mixed document",
			doc: map[string]interface{}{
				"userId": "user-123",
				"lang":   "en",
				"openai": map[string]interface{}{
					"apiKey": "sk-123",
				},
				"rpc": []interface{}{
					map[string]interface{}{
						"alias":      "/rpc1",
						"privateKey": "key1",
					},
				},
				"mcp": []interface{}{
					map[string]interface{}{
						"alias": "/mcp1",
						"env": map[string]string{
							"KEY": "value",
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Deep copy doc
			docCopy := copyDoc(tt.doc)

			// Encrypt
			if err := encryptor.Encrypt(docCopy); err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			// Verify encryption happened
			if hasPlaintextSecrets(docCopy, tt.doc) {
				t.Error("expected secrets to be encrypted")
			}

			// Decrypt
			if err := encryptor.Decrypt(docCopy); err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			// Verify decryption (only check non-serialized fields, serialized ones change type)
			verifyDecryption(t, docCopy, tt.doc)
		})
	}
}

func TestDocumentEncryptor_IdempotentEncryption(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	if err != nil {
		t.Fatalf("NewDocumentEncryptor failed: %v", err)
	}

	doc := map[string]interface{}{
		"openai": map[string]interface{}{
			"apiKey": "sk-123",
		},
	}

	// Encrypt once
	if err := encryptor.Encrypt(doc); err != nil {
		t.Fatalf("first Encrypt failed: %v", err)
	}

	encryptedOnce := copyDoc(doc)

	// Encrypt again (should be idempotent)
	if err := encryptor.Encrypt(doc); err != nil {
		t.Fatalf("second Encrypt failed: %v", err)
	}

	if !docsEqual(doc, encryptedOnce) {
		t.Error("double encryption should be idempotent")
	}
}

func TestDocumentEncryptor_MixedState(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	if err != nil {
		t.Fatalf("NewDocumentEncryptor failed: %v", err)
	}

	// Create a document with one field already encrypted
	docForPreEncrypt := map[string]interface{}{
		"openai": map[string]interface{}{
			"apiKey": "sk-openai-encrypted",
		},
	}
	if err := encryptor.Encrypt(docForPreEncrypt); err != nil {
		t.Fatalf("pre-encrypt failed: %v", err)
	}
	preEncryptedKey := docForPreEncrypt["openai"].(map[string]interface{})["apiKey"]

	// Now simulate mixed state: some already encrypted, some plaintext
	doc := map[string]interface{}{
		"openai": map[string]interface{}{
			"apiKey": preEncryptedKey, // Already encrypted
		},
		"claude": map[string]interface{}{
			"apiKey": "sk-plaintext", // Plaintext
		},
	}

	// Decrypt should handle both
	if err := encryptor.Decrypt(doc); err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	// OpenAI key should be decrypted
	openaiKey := doc["openai"].(map[string]interface{})["apiKey"]
	if openaiKey != "sk-openai-encrypted" {
		t.Errorf("openai key = %v, want sk-openai-encrypted", openaiKey)
	}

	// Claude key should remain plaintext (wasn't actually encrypted)
	claudeKey := doc["claude"].(map[string]interface{})["apiKey"]
	if claudeKey != "sk-plaintext" {
		t.Errorf("plaintext key = %v, want sk-plaintext", claudeKey)
	}
}

// Helper functions

func verifyDecryption(t *testing.T, decrypted, original map[string]interface{}) {
	// Check simple string fields
	if openai, ok := original["openai"].(map[string]interface{}); ok {
		if apiKey, ok := openai["apiKey"].(string); ok {
			decOpenai := decrypted["openai"].(map[string]interface{})
			decKey := decOpenai["apiKey"].(string)
			if decKey != apiKey {
				t.Errorf("openai.apiKey = %v, want %v", decKey, apiKey)
			}
		}
	}

	// Check RPC privateKey (non-serialized)
	if rpc, ok := original["rpc"].([]interface{}); ok && len(rpc) > 0 {
		if item, ok := rpc[0].(map[string]interface{}); ok {
			if pk, ok := item["privateKey"].(string); ok {
				decRPC := decrypted["rpc"].([]interface{})
				decItem := decRPC[0].(map[string]interface{})
				decPK := decItem["privateKey"].(string)
				if decPK != pk {
					t.Errorf("rpc[0].privateKey = %v, want %v", decPK, pk)
				}
			}

			// Check that serialized fields (headers, env) exist and are maps
			if _, hasHeaders := item["headers"]; hasHeaders {
				decItem := decrypted["rpc"].([]interface{})[0].(map[string]interface{})
				if _, ok := decItem["headers"].(map[string]interface{}); !ok {
					t.Error("headers should be deserialized to map")
				}
			}
		}
	}

	// Check MCP env (serialized)
	if mcp, ok := original["mcp"].([]interface{}); ok && len(mcp) > 0 {
		if item, ok := mcp[0].(map[string]interface{}); ok {
			if _, hasEnv := item["env"]; hasEnv {
				decMCP := decrypted["mcp"].([]interface{})
				decItem := decMCP[0].(map[string]interface{})
				if _, ok := decItem["env"].(map[string]interface{}); !ok {
					t.Error("env should be deserialized to map")
				}
			}
		}
	}
}

func copyDoc(doc map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range doc {
		switch val := v.(type) {
		case map[string]interface{}:
			result[k] = copyDoc(val)
		case []interface{}:
			result[k] = copyArray(val)
		default:
			result[k] = v
		}
	}
	return result
}

func copyArray(arr []interface{}) []interface{} {
	result := make([]interface{}, len(arr))
	for i, v := range arr {
		if m, ok := v.(map[string]interface{}); ok {
			result[i] = copyDoc(m)
		} else {
			result[i] = v
		}
	}
	return result
}

func hasPlaintextSecrets(encrypted, original map[string]interface{}) bool {
	// Check if OpenAI key is still plaintext
	if openai, ok := original["openai"].(map[string]interface{}); ok {
		if apiKey, ok := openai["apiKey"].(string); ok {
			encOpenai := encrypted["openai"].(map[string]interface{})
			encKey := encOpenai["apiKey"].(string)
			if encKey == apiKey {
				return true
			}
		}
	}

	// Check RPC privateKey
	if rpc, ok := original["rpc"].([]interface{}); ok && len(rpc) > 0 {
		if item, ok := rpc[0].(map[string]interface{}); ok {
			if pk, ok := item["privateKey"].(string); ok {
				encRPC := encrypted["rpc"].([]interface{})
				encItem := encRPC[0].(map[string]interface{})
				encPK := encItem["privateKey"].(string)
				if encPK == pk && !strings.Contains(encPK, "__encrypted__") {
					return true
				}
			}
		}
	}

	return false
}

func docsEqual(a, b map[string]interface{}) bool {
	if len(a) != len(b) {
		return false
	}

	for k, va := range a {
		vb, ok := b[k]
		if !ok {
			return false
		}

		switch va := va.(type) {
		case map[string]interface{}:
			vbMap, ok := vb.(map[string]interface{})
			if !ok || !docsEqual(va, vbMap) {
				return false
			}
		case []interface{}:
			vbArr, ok := vb.([]interface{})
			if !ok || !arraysEqual(va, vbArr) {
				return false
			}
		default:
			if va != vb {
				return false
			}
		}
	}

	return true
}

func arraysEqual(a, b []interface{}) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		aMap, aOk := a[i].(map[string]interface{})
		bMap, bOk := b[i].(map[string]interface{})

		if aOk && bOk {
			if !docsEqual(aMap, bMap) {
				return false
			}
		} else if a[i] != b[i] {
			return false
		}
	}

	return true
}
