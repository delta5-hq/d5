package integration

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Cross-language encryption compatibility tests.
//
// Scope: properties that must hold across the Go↔Node boundary:
//   - wire format: base64(IV[16] ‖ AuthTag[16] ‖ Ciphertext)
//   - marker:      "__encrypted__" prefix
//   - key:         PBKDF2-SHA256, 10000 iter, salt=sha256(secret+"field-encryption-salt")
//   - AAD:         length-prefixed [collection ‖ userId ‖ workflowId ‖ fieldPath]
//   - scope:       userId and workflowId are part of the AAD; swapping either fails auth
//
// Unit-level cipher and document round-trip tests live in:
//
//	encryption/aead_test.go          (cipher, AD builder, tamper resistance)
//	document_encryptor_test.go       (provider coverage, idempotence, mixed state)
//
// Shared fixture (must stay in sync with crossLanguageEncryption.test.js):
//
//	fixtureUserID, fixturePlaintext, goEncryptedFixture
//
// To regenerate the fixture after a wire-format change:
//
//	go test -run TestCrossLanguageEncryption_RegenerateFixture -v ./internal/modules/integration/
//
// Then update goEncryptedFixture here and GO_ENCRYPTED_FIXTURE in crossLanguageEncryption.test.js.
const (
	fixtureUserID    = "user-cross-lang-test"
	fixturePlaintext = "sk-openai-cross-lang-test-fixture"

	// Produced by Go DocumentEncryptor with JWT_SECRET = "test-jwt-secret-change-in-production".
	// Node decrypts this same value in crossLanguageEncryption.test.js.
	goEncryptedFixture = "__encrypted__ioZRZ6vVZgVIiVWNMAvhkTYdXfv+yksVy1SuNi4bXe+ypqiCLEvnSCwqDDPKvk21mXnegVpEHu9ckPlwVLaeXa8="
)

// TestCrossLanguageEncryption_WireFormat verifies the byte layout of Go-produced
// ciphertext matches the contract Node consumes: base64(IV[16]‖AuthTag[16]‖Body).
func TestCrossLanguageEncryption_WireFormat(t *testing.T) {
	const (
		ivLen      = 16
		authTagLen = 16
		minBodyLen = 1
	)

	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err, "NewDocumentEncryptor")

	providers := []struct {
		name     string
		provider string
		field    string
		value    string
	}{
		{"openai.apiKey", "openai", "apiKey", "sk-openai-wire-test"},
		{"claude.apiKey", "claude", "apiKey", "sk-ant-wire-test"},
		{"deepseek.apiKey", "deepseek", "apiKey", "sk-ds-wire-test"},
		{"qwen.apiKey", "qwen", "apiKey", "sk-qwen-wire-test"},
		{"perplexity.apiKey", "perplexity", "apiKey", "sk-pplx-wire-test"},
		{"yandex.apiKey", "yandex", "apiKey", "yandex-wire-test"},
		{"custom_llm.apiKey", "custom_llm", "apiKey", "custom-wire-test"},
	}

	for _, p := range providers {
		t.Run(p.name, func(t *testing.T) {
			doc := map[string]interface{}{
				p.provider: map[string]interface{}{p.field: p.value},
			}

			require.NoError(t, encryptor.Encrypt(doc, "wire-test-user", nil))

			raw := doc[p.provider].(map[string]interface{})[p.field].(string)
			assert.True(t, strings.HasPrefix(raw, "__encrypted__"), "missing marker prefix")

			payload := strings.TrimPrefix(raw, "__encrypted__")
			decoded, err := base64.StdEncoding.DecodeString(payload)
			require.NoError(t, err, "base64 decode")
			assert.GreaterOrEqual(t, len(decoded), ivLen+authTagLen+minBodyLen,
				"ciphertext too short for IV‖AuthTag‖Body layout")
		})
	}
}

// TestCrossLanguageEncryption_NonSecretFieldsPassThrough verifies fields not in
// the encryption config are left unmodified — a property Node relies on when
// deserialising the full integration document.
func TestCrossLanguageEncryption_NonSecretFieldsPassThrough(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	doc := map[string]interface{}{
		"openai": map[string]interface{}{
			"apiKey": "sk-secret",
			"model":  "gpt-4.1-mini",
		},
		"yandex": map[string]interface{}{
			"apiKey":    "yandex-secret",
			"folder_id": "my-folder",
		},
		"lang":  "en",
		"model": "auto",
	}

	require.NoError(t, encryptor.Encrypt(doc, "passthrough-user", nil))

	openai := doc["openai"].(map[string]interface{})
	assert.Equal(t, "gpt-4.1-mini", openai["model"])

	yandex := doc["yandex"].(map[string]interface{})
	assert.Equal(t, "my-folder", yandex["folder_id"])

	assert.Equal(t, "en", doc["lang"])
	assert.Equal(t, "auto", doc["model"])
}

// TestCrossLanguageEncryption_GoDecryptsNodeFixture proves Go can decrypt the
// static ciphertext that the Node test suite uses.  A failure here means the
// wire format, key derivation, or AAD layout diverged between languages.
func TestCrossLanguageEncryption_GoDecryptsNodeFixture(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	doc := map[string]interface{}{
		"openai": map[string]interface{}{"apiKey": goEncryptedFixture},
	}

	require.NoError(t, encryptor.Decrypt(doc, fixtureUserID, nil), "Go failed to decrypt Node fixture")

	recovered := doc["openai"].(map[string]interface{})["apiKey"].(string)
	assert.Equal(t, fixturePlaintext, recovered)
}

// TestCrossLanguageEncryption_ScopeIsolation verifies that AAD binds ciphertext
// to both userId and workflowId, so a Go-encrypted value cannot be decrypted
// with different scope coordinates — matching Node's FallbackDecrypt expectation.
func TestCrossLanguageEncryption_ScopeIsolation(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	wfID := stringPtr("wf-abc")

	cases := []struct {
		name        string
		encUserID   string
		encWfID     *string
		decUserID   string
		decWfID     *string
		expectError bool
	}{
		{
			name:      "correct scope decrypts",
			encUserID: "user-A", encWfID: nil,
			decUserID: "user-A", decWfID: nil,
			expectError: false,
		},
		{
			name:      "wrong userId rejected",
			encUserID: "user-A", encWfID: nil,
			decUserID: "user-B", decWfID: nil,
			expectError: true,
		},
		{
			name:      "global scope rejected as workflow scope",
			encUserID: "user-A", encWfID: nil,
			decUserID: "user-A", decWfID: wfID,
			expectError: true,
		},
		{
			name:      "workflow scope rejected as global scope",
			encUserID: "user-A", encWfID: wfID,
			decUserID: "user-A", decWfID: nil,
			expectError: true,
		},
		{
			name:      "different workflow IDs rejected",
			encUserID: "user-A", encWfID: wfID,
			decUserID: "user-A", decWfID: stringPtr("wf-xyz"),
			expectError: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			doc := map[string]interface{}{
				"openai": map[string]interface{}{"apiKey": "sk-scope-test"},
			}

			require.NoError(t, encryptor.Encrypt(doc, tc.encUserID, tc.encWfID))

			err := encryptor.Decrypt(doc, tc.decUserID, tc.decWfID)
			if tc.expectError {
				assert.Error(t, err, "expected decryption to fail for mismatched scope")
			} else {
				require.NoError(t, err)
				recovered := doc["openai"].(map[string]interface{})["apiKey"].(string)
				assert.Equal(t, "sk-scope-test", recovered)
			}
		})
	}
}

// TestCrossLanguageEncryption_AllLLMProviderFields verifies every secret field
// in INTEGRATION_ENCRYPTION_CONFIG survives a Go encrypt→decrypt round-trip.
func TestCrossLanguageEncryption_AllLLMProviderFields(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	doc := map[string]interface{}{
		"openai":     map[string]interface{}{"apiKey": "sk-openai-abc", "model": "gpt-4"},
		"claude":     map[string]interface{}{"apiKey": "sk-claude-abc", "model": "claude-3"},
		"deepseek":   map[string]interface{}{"apiKey": "sk-deepseek-abc"},
		"qwen":       map[string]interface{}{"apiKey": "sk-qwen-abc"},
		"perplexity": map[string]interface{}{"apiKey": "sk-pplx-abc"},
		"yandex":     map[string]interface{}{"apiKey": "yandex-abc", "folder_id": "folder-1"},
		"custom_llm": map[string]interface{}{"apiKey": "custom-abc"},
		"lang":       "en",
		"model":      "auto",
	}

	original := copyDoc(doc)
	userID := "provider-coverage-user"

	require.NoError(t, encryptor.Encrypt(doc, userID, nil))

	for _, provider := range []string{"openai", "claude", "deepseek", "qwen", "perplexity", "yandex", "custom_llm"} {
		enc := doc[provider].(map[string]interface{})["apiKey"].(string)
		orig := original[provider].(map[string]interface{})["apiKey"].(string)
		assert.True(t, strings.HasPrefix(enc, "__encrypted__"),
			"provider %s: apiKey missing encryption marker", provider)
		assert.NotEqual(t, orig, enc,
			"provider %s: apiKey was not encrypted", provider)
	}

	require.NoError(t, encryptor.Decrypt(doc, userID, nil))

	for _, provider := range []string{"openai", "claude", "deepseek", "qwen", "perplexity", "yandex", "custom_llm"} {
		recovered := doc[provider].(map[string]interface{})["apiKey"].(string)
		expected := original[provider].(map[string]interface{})["apiKey"].(string)
		assert.Equal(t, expected, recovered, "provider %s: round-trip failed", provider)
	}

	assert.Equal(t, "folder-1", doc["yandex"].(map[string]interface{})["folder_id"],
		"yandex.folder_id must not be encrypted")
	assert.Equal(t, "gpt-4", doc["openai"].(map[string]interface{})["model"])
	assert.Equal(t, "en", doc["lang"])
	assert.Equal(t, "auto", doc["model"])
}

// TestCrossLanguageEncryption_RandomIVProducesDifferentCiphertexts confirms
// the same plaintext+context yields distinct ciphertexts on successive calls,
// ensuring Go does not use a deterministic or reused IV.
func TestCrossLanguageEncryption_RandomIVProducesDifferentCiphertexts(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	plaintext := "sk-same-key-every-time"
	userID := "iv-test-user"

	doc1 := map[string]interface{}{"openai": map[string]interface{}{"apiKey": plaintext}}
	doc2 := map[string]interface{}{"openai": map[string]interface{}{"apiKey": plaintext}}

	require.NoError(t, encryptor.Encrypt(doc1, userID, nil))
	require.NoError(t, encryptor.Encrypt(doc2, userID, nil))

	ct1 := doc1["openai"].(map[string]interface{})["apiKey"].(string)
	ct2 := doc2["openai"].(map[string]interface{})["apiKey"].(string)
	assert.NotEqual(t, ct1, ct2, "two encryptions of the same plaintext must differ (random IV)")
}

// TestCrossLanguageEncryption_RegenerateFixture is a manual helper.
// Remove the t.Skip() call, run the test, copy the printed value to
// goEncryptedFixture here and GO_ENCRYPTED_FIXTURE in crossLanguageEncryption.test.js.
func TestCrossLanguageEncryption_RegenerateFixture(t *testing.T) {
	t.Skip("manual only — remove Skip to regenerate, then update fixture constants in both test files")

	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	doc := map[string]interface{}{
		"openai": map[string]interface{}{"apiKey": fixturePlaintext},
	}

	require.NoError(t, encryptor.Encrypt(doc, fixtureUserID, nil))

	t.Logf("goEncryptedFixture = %q", doc["openai"].(map[string]interface{})["apiKey"])
	t.Logf("fixtureUserID      = %q", fixtureUserID)
	t.Logf("fixturePlaintext   = %q", fixturePlaintext)
}
