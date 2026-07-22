package encryption

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAEAD_BasicFunctionality(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))

	t.Run("encrypts and decrypts with matching AD", func(t *testing.T) {
		plaintext := "secret-api-key-12345"
		ad := []byte("context-info")

		encrypted, err := cipher.Encrypt(plaintext, key, ad)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, ad)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)
	})

	t.Run("rejects decryption when AD mismatches", func(t *testing.T) {
		plaintext := "secret-api-key-12345"
		ad := []byte("context-info")
		wrongAD := []byte("wrong-context")

		encrypted, err := cipher.Encrypt(plaintext, key, ad)
		require.NoError(t, err)

		_, err = cipher.Decrypt(encrypted, key, wrongAD)
		assert.Error(t, err)
	})

	t.Run("rejects decryption with nil AD when encrypted with AD", func(t *testing.T) {
		plaintext := "secret-api-key-12345"
		ad := []byte("context-info")

		encrypted, err := cipher.Encrypt(plaintext, key, ad)
		require.NoError(t, err)

		_, err = cipher.Decrypt(encrypted, key, nil)
		assert.Error(t, err)
	})

	t.Run("rejects decryption with AD when encrypted without AD", func(t *testing.T) {
		plaintext := "secret-api-key-12345"
		ad := []byte("context-info")

		encrypted, err := cipher.Encrypt(plaintext, key, nil)
		require.NoError(t, err)

		_, err = cipher.Decrypt(encrypted, key, ad)
		assert.Error(t, err)
	})

	t.Run("handles empty AD as distinct from nil AD", func(t *testing.T) {
		plaintext := "secret-api-key-12345"
		emptyAD := []byte{}

		encrypted, err := cipher.Encrypt(plaintext, key, emptyAD)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, emptyAD)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decrypted)
	})

	t.Run("empty AD and nil AD are equivalent in GCM", func(t *testing.T) {
		plaintext := "secret-api-key-12345"
		emptyAD := []byte{}

		encryptedWithNil, err := cipher.Encrypt(plaintext, key, nil)
		require.NoError(t, err)

		decryptedWithEmpty, err := cipher.Decrypt(encryptedWithNil, key, emptyAD)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decryptedWithEmpty)

		encryptedWithEmpty, err := cipher.Encrypt(plaintext, key, emptyAD)
		require.NoError(t, err)

		decryptedWithNil, err := cipher.Decrypt(encryptedWithEmpty, key, nil)
		require.NoError(t, err)
		assert.Equal(t, plaintext, decryptedWithNil)
	})
}

func TestAEAD_ContextBindingPreventsRelocation(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))
	builder := NewADBuilder()

	t.Run("user separation", func(t *testing.T) {
		t.Run("prevents copying ciphertext between users", func(t *testing.T) {
			apiKey := "sk-secret-key-abc123"
			user1AD := builder.BuildForLLMField("user-1", "", "openai.apiKey")
			user2AD := builder.BuildForLLMField("user-2", "", "openai.apiKey")

			encrypted, err := cipher.Encrypt(apiKey, key, user1AD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, user2AD)
			assert.Error(t, err)
		})

		t.Run("allows same user to decrypt their own data", func(t *testing.T) {
			apiKey := "sk-secret-key-abc123"
			userAD := builder.BuildForLLMField("user-1", "", "openai.apiKey")

			encrypted, err := cipher.Encrypt(apiKey, key, userAD)
			require.NoError(t, err)

			decrypted, err := cipher.Decrypt(encrypted, key, userAD)
			require.NoError(t, err)
			assert.Equal(t, apiKey, decrypted)
		})
	})

	t.Run("workflow scope separation", func(t *testing.T) {
		t.Run("prevents copying user-level ciphertext to workflow scope", func(t *testing.T) {
			apiKey := "sk-secret-key-abc123"
			userLevelAD := builder.BuildForLLMField("user-1", "", "openai.apiKey")
			workflowAD := builder.BuildForLLMField("user-1", "workflow-123", "openai.apiKey")

			encrypted, err := cipher.Encrypt(apiKey, key, userLevelAD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, workflowAD)
			assert.Error(t, err)
		})

		t.Run("prevents copying workflow-scoped ciphertext to user level", func(t *testing.T) {
			apiKey := "sk-secret-key-abc123"
			workflowAD := builder.BuildForLLMField("user-1", "workflow-123", "openai.apiKey")
			userLevelAD := builder.BuildForLLMField("user-1", "", "openai.apiKey")

			encrypted, err := cipher.Encrypt(apiKey, key, workflowAD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, userLevelAD)
			assert.Error(t, err)
		})

		t.Run("prevents copying between different workflows", func(t *testing.T) {
			apiKey := "sk-secret-key-abc123"
			workflow1AD := builder.BuildForLLMField("user-1", "workflow-A", "openai.apiKey")
			workflow2AD := builder.BuildForLLMField("user-1", "workflow-B", "openai.apiKey")

			encrypted, err := cipher.Encrypt(apiKey, key, workflow1AD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, workflow2AD)
			assert.Error(t, err)
		})
	})

	t.Run("field path separation", func(t *testing.T) {
		t.Run("prevents copying ciphertext between different fields", func(t *testing.T) {
			apiKey := "sk-secret-key-abc123"
			openaiAD := builder.BuildForLLMField("user-1", "", "openai.apiKey")
			claudeAD := builder.BuildForLLMField("user-1", "", "claude.apiKey")

			encrypted, err := cipher.Encrypt(apiKey, key, openaiAD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, claudeAD)
			assert.Error(t, err)
		})

		t.Run("prevents copying between nested field paths", func(t *testing.T) {
			secret := "sensitive-data"
			field1AD := builder.BuildForLLMField("user-1", "", "level1.level2.secret")
			field2AD := builder.BuildForLLMField("user-1", "", "level1.level3.secret")

			encrypted, err := cipher.Encrypt(secret, key, field1AD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, field2AD)
			assert.Error(t, err)
		})
	})

	t.Run("array field separation", func(t *testing.T) {
		t.Run("prevents copying between different array items by alias", func(t *testing.T) {
			privateKey := "ssh-rsa AAAA..."
			alias1AD := builder.BuildForArrayField("user-1", "", "rpc", "server-A", "privateKey")
			alias2AD := builder.BuildForArrayField("user-1", "", "rpc", "server-B", "privateKey")

			encrypted, err := cipher.Encrypt(privateKey, key, alias1AD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, alias2AD)
			assert.Error(t, err)
		})

		t.Run("prevents copying between different arrays", func(t *testing.T) {
			headers := `{"X-API-Key":"secret"}`
			mcpAD := builder.BuildForArrayField("user-1", "", "mcp", "server-1", "headers")
			rpcAD := builder.BuildForArrayField("user-1", "", "rpc", "server-1", "headers")

			encrypted, err := cipher.Encrypt(headers, key, mcpAD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, rpcAD)
			assert.Error(t, err)
		})

		t.Run("prevents copying between different fields within same array item", func(t *testing.T) {
			secret := "sensitive-value"
			privateKeyAD := builder.BuildForArrayField("user-1", "", "rpc", "server-A", "privateKey")
			passphraseAD := builder.BuildForArrayField("user-1", "", "rpc", "server-A", "passphrase")

			encrypted, err := cipher.Encrypt(secret, key, privateKeyAD)
			require.NoError(t, err)

			_, err = cipher.Decrypt(encrypted, key, passphraseAD)
			assert.Error(t, err)
		})
	})
}

func TestAEAD_EdgeCasesAndBoundaryConditions(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))
	builder := NewADBuilder()

	t.Run("handles very long userId in AD", func(t *testing.T) {
		longUserId := strings.Repeat("u", 1000)
		ad := builder.BuildForLLMField(longUserId, "", "openai.apiKey")

		encrypted, err := cipher.Encrypt("secret", key, ad)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, ad)
		require.NoError(t, err)
		assert.Equal(t, "secret", decrypted)
	})

	t.Run("handles very long workflowId in AD", func(t *testing.T) {
		longWorkflowId := strings.Repeat("w", 1000)
		ad := builder.BuildForLLMField("user-1", longWorkflowId, "openai.apiKey")

		encrypted, err := cipher.Encrypt("secret", key, ad)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, ad)
		require.NoError(t, err)
		assert.Equal(t, "secret", decrypted)
	})

	t.Run("handles special characters in userId", func(t *testing.T) {
		specialUserId := "user-with-special!@#$%^&*()chars"
		ad := builder.BuildForLLMField(specialUserId, "", "openai.apiKey")

		encrypted, err := cipher.Encrypt("secret", key, ad)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, ad)
		require.NoError(t, err)
		assert.Equal(t, "secret", decrypted)
	})

	t.Run("handles UTF-8 emoji in context", func(t *testing.T) {
		ad := builder.BuildForLLMField("user-🔒", "workflow-🎯", "field-🔑")

		encrypted, err := cipher.Encrypt("secret", key, ad)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, ad)
		require.NoError(t, err)
		assert.Equal(t, "secret", decrypted)
	})

	t.Run("handles multibyte UTF-8 characters", func(t *testing.T) {
		ad := builder.BuildForLLMField("用户-123", "ワークフロー", "名前.秘密")

		encrypted, err := cipher.Encrypt("secret", key, ad)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, ad)
		require.NoError(t, err)
		assert.Equal(t, "secret", decrypted)
	})

	t.Run("handles AD with all empty parts except collection", func(t *testing.T) {
		ad := builder.BuildForLLMField("", "", "")

		encrypted, err := cipher.Encrypt("secret", key, ad)
		require.NoError(t, err)

		decrypted, err := cipher.Decrypt(encrypted, key, ad)
		require.NoError(t, err)
		assert.Equal(t, "secret", decrypted)
	})

	t.Run("produces different ciphertext for same plaintext with different AD", func(t *testing.T) {
		plaintext := "same-secret"
		ad1 := builder.BuildForLLMField("user-1", "", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-2", "", "openai.apiKey")

		encrypted1, err := cipher.Encrypt(plaintext, key, ad1)
		require.NoError(t, err)

		encrypted2, err := cipher.Encrypt(plaintext, key, ad2)
		require.NoError(t, err)

		assert.NotEqual(t, encrypted1, encrypted2)
	})

	t.Run("produces different ciphertext for same plaintext and AD due to random IV", func(t *testing.T) {
		plaintext := "same-secret"
		ad := builder.BuildForLLMField("user-1", "", "openai.apiKey")

		encrypted1, err := cipher.Encrypt(plaintext, key, ad)
		require.NoError(t, err)

		encrypted2, err := cipher.Encrypt(plaintext, key, ad)
		require.NoError(t, err)

		assert.NotEqual(t, encrypted1, encrypted2)
	})
}

func TestAEAD_Determinism(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))
	builder := NewADBuilder()

	t.Run("produces identical AD bytes for identical inputs", func(t *testing.T) {
		ad1 := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")

		assert.Equal(t, ad1, ad2)
	})

	t.Run("decryption succeeds with independently built identical AD", func(t *testing.T) {
		plaintext := "secret-key"
		ad1 := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")

		encrypted, err := cipher.Encrypt(plaintext, key, ad1)
		require.NoError(t, err)

		ad2 := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")
		decrypted, err := cipher.Decrypt(encrypted, key, ad2)
		require.NoError(t, err)

		assert.Equal(t, plaintext, decrypted)
	})
}

func TestAEAD_TamperResistance(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))
	builder := NewADBuilder()

	t.Run("detects tampering with ciphertext body", func(t *testing.T) {
		plaintext := "secret-key"
		ad := builder.BuildForLLMField("user-1", "", "openai.apiKey")

		encrypted, err := cipher.Encrypt(plaintext, key, ad)
		require.NoError(t, err)

		ciphertextBytes := []byte(encrypted)
		ciphertextBytes[len(ciphertextBytes)-1] ^= 0x01
		tampered := string(ciphertextBytes)

		_, err = cipher.Decrypt(tampered, key, ad)
		assert.Error(t, err)
	})
}
