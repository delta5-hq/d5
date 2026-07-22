package integration

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDocumentEncryptor_RejectsCrossUserRelocation(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	t.Run("LLM field encrypted for user-A cannot be decrypted by user-B", func(t *testing.T) {
		doc := map[string]interface{}{
			"openai": map[string]interface{}{"apiKey": "sk-secret-123"},
		}

		user1 := "user-1"
		user2 := "user-2"

		err := encryptor.Encrypt(doc, user1, nil)
		require.NoError(t, err)

		err = encryptor.Decrypt(doc, user2, nil)
		assert.Error(t, err)
	})

	t.Run("array field encrypted for user-A cannot be decrypted by user-B", func(t *testing.T) {
		doc := map[string]interface{}{
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":   "srv1",
					"headers": map[string]interface{}{"Auth": "token"},
				},
			},
		}

		user1 := "user-1"
		user2 := "user-2"

		err := encryptor.Encrypt(doc, user1, nil)
		require.NoError(t, err)

		err = encryptor.Decrypt(doc, user2, nil)
		assert.Error(t, err)
	})
}

func TestDocumentEncryptor_RejectsCrossFieldRelocation(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	t.Run("ciphertext cannot be copied between different fields", func(t *testing.T) {
		docOpenAI := map[string]interface{}{
			"openai": map[string]interface{}{"apiKey": "sk-secret-123"},
		}

		userId := "user-1"

		err := encryptor.Encrypt(docOpenAI, userId, nil)
		require.NoError(t, err)

		encryptedKey := docOpenAI["openai"].(map[string]interface{})["apiKey"]

		docClaude := map[string]interface{}{
			"claude": map[string]interface{}{"apiKey": encryptedKey},
		}

		err = encryptor.Decrypt(docClaude, userId, nil)
		assert.Error(t, err)
	})

	t.Run("ciphertext cannot be copied between nested field paths", func(t *testing.T) {
		encryptor, err := NewDocumentEncryptor()
		require.NoError(t, err)

		doc1 := map[string]interface{}{
			"openai": map[string]interface{}{"apiKey": "secret1"},
		}
		doc2 := map[string]interface{}{
			"claude": map[string]interface{}{"apiKey": "secret2"},
		}

		userId := "user-1"

		err = encryptor.Encrypt(doc1, userId, nil)
		require.NoError(t, err)
		err = encryptor.Encrypt(doc2, userId, nil)
		require.NoError(t, err)

		doc1["openai"].(map[string]interface{})["apiKey"], doc2["claude"].(map[string]interface{})["apiKey"] =
			doc2["claude"].(map[string]interface{})["apiKey"], doc1["openai"].(map[string]interface{})["apiKey"]

		err = encryptor.Decrypt(doc1, userId, nil)
		assert.Error(t, err)
		err = encryptor.Decrypt(doc2, userId, nil)
		assert.Error(t, err)
	})
}

func TestDocumentEncryptor_RejectsCrossAliasRelocation(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	t.Run("array item ciphertext cannot be moved between aliases", func(t *testing.T) {
		doc := map[string]interface{}{
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":   "srv1",
					"headers": map[string]interface{}{"Auth": "token1"},
				},
				map[string]interface{}{
					"alias":   "srv2",
					"headers": map[string]interface{}{"Auth": "token2"},
				},
			},
		}

		userId := "user-1"

		err := encryptor.Encrypt(doc, userId, nil)
		require.NoError(t, err)

		mcpArray := doc["mcp"].([]interface{})
		item1 := mcpArray[0].(map[string]interface{})
		item2 := mcpArray[1].(map[string]interface{})

		item1["headers"], item2["headers"] = item2["headers"], item1["headers"]

		err = encryptor.Decrypt(doc, userId, nil)
		assert.Error(t, err)
	})

	t.Run("ciphertext cannot be moved between different arrays", func(t *testing.T) {
		docMCP := map[string]interface{}{
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":   "srv",
					"headers": map[string]interface{}{"Auth": "token"},
				},
			},
		}

		userId := "user-1"

		err := encryptor.Encrypt(docMCP, userId, nil)
		require.NoError(t, err)

		mcpHeaders := docMCP["mcp"].([]interface{})[0].(map[string]interface{})["headers"]

		docRPC := map[string]interface{}{
			"rpc": []interface{}{
				map[string]interface{}{
					"alias":   "srv",
					"headers": mcpHeaders,
				},
			},
		}

		err = encryptor.Decrypt(docRPC, userId, nil)
		assert.Error(t, err)
	})

	t.Run("ciphertext cannot be moved between fields within same array item", func(t *testing.T) {
		doc := map[string]interface{}{
			"rpc": []interface{}{
				map[string]interface{}{
					"alias":      "srv",
					"privateKey": "ssh-key",
					"passphrase": "secret-pass",
				},
			},
		}

		userId := "user-1"

		err := encryptor.Encrypt(doc, userId, nil)
		require.NoError(t, err)

		item := doc["rpc"].([]interface{})[0].(map[string]interface{})
		item["privateKey"], item["passphrase"] = item["passphrase"], item["privateKey"]

		err = encryptor.Decrypt(doc, userId, nil)
		assert.Error(t, err)
	})
}

func TestDocumentEncryptor_RejectsCrossWorkflowRelocation(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	t.Run("user-level ciphertext cannot be moved to workflow scope", func(t *testing.T) {
		doc := map[string]interface{}{
			"openai": map[string]interface{}{"apiKey": "sk-secret-123"},
		}

		userId := "user-1"
		workflowId := "wf-123"

		err := encryptor.Encrypt(doc, userId, nil)
		require.NoError(t, err)

		err = encryptor.Decrypt(doc, userId, &workflowId)
		assert.Error(t, err)
	})

	t.Run("workflow-scoped ciphertext cannot be moved to user level", func(t *testing.T) {
		doc := map[string]interface{}{
			"openai": map[string]interface{}{"apiKey": "sk-secret-123"},
		}

		userId := "user-1"
		workflowId := "wf-123"

		err := encryptor.Encrypt(doc, userId, &workflowId)
		require.NoError(t, err)

		err = encryptor.Decrypt(doc, userId, nil)
		assert.Error(t, err)
	})

	t.Run("ciphertext cannot be moved between different workflows", func(t *testing.T) {
		doc := map[string]interface{}{
			"openai": map[string]interface{}{"apiKey": "sk-secret-123"},
		}

		userId := "user-1"
		workflow1 := "wf-A"
		workflow2 := "wf-B"

		err := encryptor.Encrypt(doc, userId, &workflow1)
		require.NoError(t, err)

		err = encryptor.Decrypt(doc, userId, &workflow2)
		assert.Error(t, err)
	})
}

func TestDocumentEncryptor_AcceptsRoundTripWithConsistentContext(t *testing.T) {
	encryptor, err := NewDocumentEncryptor()
	require.NoError(t, err)

	t.Run("full integration document roundtrip with all field types", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId":     "user-1",
			"workflowId": "wf-1",
			"openai":     map[string]interface{}{"apiKey": "openai-secret"},
			"claude":     map[string]interface{}{"apiKey": "claude-secret"},
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":   "srv1",
					"headers": map[string]interface{}{"auth": "token1"},
				},
				map[string]interface{}{
					"alias": "srv2",
					"env":   map[string]interface{}{"KEY": "val"},
				},
			},
			"rpc": []interface{}{
				map[string]interface{}{
					"alias":      "vm1",
					"privateKey": "ssh-key",
					"passphrase": "pass",
				},
			},
		}

		userId := "user-1"
		workflowId := "wf-1"

		err := encryptor.Encrypt(doc, userId, &workflowId)
		require.NoError(t, err)

		err = encryptor.Decrypt(doc, userId, &workflowId)
		require.NoError(t, err)

		assert.Equal(t, "openai-secret", doc["openai"].(map[string]interface{})["apiKey"])
		assert.Equal(t, "claude-secret", doc["claude"].(map[string]interface{})["apiKey"])
		assert.Equal(t, "ssh-key", doc["rpc"].([]interface{})[0].(map[string]interface{})["privateKey"])
	})
}
