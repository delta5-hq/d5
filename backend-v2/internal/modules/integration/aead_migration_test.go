package integration

import (
	"backend-v2/internal/common/encryption"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDocumentMigrator_MigratesLegacyNilADData(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	t.Run("migrates LLM field encrypted with nil AD", func(t *testing.T) {
		legacyEncrypted, err := service.Encrypt("sk-legacy-key", nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": legacyEncrypted},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		builder := encryption.NewADBuilder()
		ad := builder.BuildForLLMField("user-1", "", "openai.apiKey")

		migratedCiphertext := doc["openai"].(map[string]interface{})["apiKey"].(string)
		decrypted := verifyDecryptWithAD(t, migratedCiphertext, ad)
		assert.Equal(t, "sk-legacy-key", decrypted)
	})

	t.Run("migrates array field encrypted with nil AD", func(t *testing.T) {
		legacyHeaders, err := service.Encrypt(`{"Auth":"token"}`, nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":   "srv1",
					"headers": legacyHeaders,
				},
			},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		builder := encryption.NewADBuilder()
		ad := builder.BuildForArrayField("user-1", "", "mcp", "srv1", "headers")

		migratedCiphertext := doc["mcp"].([]interface{})[0].(map[string]interface{})["headers"].(string)
		decrypted := verifyDecryptWithAD(t, migratedCiphertext, ad)
		assert.Equal(t, `{"Auth":"token"}`, decrypted)
	})

	t.Run("skips already-migrated AD-bound data", func(t *testing.T) {
		builder := encryption.NewADBuilder()
		ad := builder.BuildForLLMField("user-1", "", "openai.apiKey")

		adEncrypted, err := service.Encrypt("sk-modern-key", ad)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": adEncrypted},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})
}

func TestDocumentMigrator_IdempotentMigration(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacyEncrypted, err := service.Encrypt("sk-secret", nil)
	require.NoError(t, err)

	doc := map[string]interface{}{
		"userId": "user-1",
		"openai": map[string]interface{}{"apiKey": legacyEncrypted},
	}

	migrated1, err := migrator.MigrateDocument(doc)
	require.NoError(t, err)
	assert.True(t, migrated1)

	firstMigrationResult := doc["openai"].(map[string]interface{})["apiKey"].(string)

	migrated2, err := migrator.MigrateDocument(doc)
	require.NoError(t, err)
	assert.False(t, migrated2, "second migration should skip already-migrated data")

	secondRunResult := doc["openai"].(map[string]interface{})["apiKey"].(string)
	assert.Equal(t, firstMigrationResult, secondRunResult, "re-running migration should not change data")
}

func TestDocumentMigrator_MixedLegacyAndModernFields(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacyEncrypted, err := service.Encrypt("sk-legacy", nil)
	require.NoError(t, err)

	builder := encryption.NewADBuilder()
	ad := builder.BuildForLLMField("user-1", "", "claude.apiKey")
	modernEncrypted, err := service.Encrypt("sk-modern", ad)
	require.NoError(t, err)

	doc := map[string]interface{}{
		"userId": "user-1",
		"openai": map[string]interface{}{"apiKey": legacyEncrypted},
		"claude": map[string]interface{}{"apiKey": modernEncrypted},
	}

	migrated, err := migrator.MigrateDocument(doc)
	require.NoError(t, err)
	assert.True(t, migrated)

	openaiAD := builder.BuildForLLMField("user-1", "", "openai.apiKey")
	claudeAD := builder.BuildForLLMField("user-1", "", "claude.apiKey")

	openaiCiphertext := doc["openai"].(map[string]interface{})["apiKey"].(string)
	claudeCiphertext := doc["claude"].(map[string]interface{})["apiKey"].(string)

	openaiDecrypted := verifyDecryptWithAD(t, openaiCiphertext, openaiAD)
	assert.Equal(t, "sk-legacy", openaiDecrypted)

	claudeDecrypted := verifyDecryptWithAD(t, claudeCiphertext, claudeAD)
	assert.Equal(t, "sk-modern", claudeDecrypted)
}

func TestDocumentMigrator_InputValidation(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	t.Run("rejects document without userId", func(t *testing.T) {
		doc := map[string]interface{}{
			"openai": map[string]interface{}{"apiKey": "sk-test"},
		}

		migrated, err := migrator.MigrateDocument(doc)
		assert.False(t, migrated)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "missing userId")
	})

	t.Run("rejects document with empty userId", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "",
			"openai": map[string]interface{}{"apiKey": "sk-test"},
		}

		migrated, err := migrator.MigrateDocument(doc)
		assert.False(t, migrated)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "missing userId")
	})

	t.Run("accepts document without workflowId", func(t *testing.T) {
		service, err := encryption.GetService()
		require.NoError(t, err)

		legacyEncrypted, err := service.Encrypt("sk-test", nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": legacyEncrypted},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)
	})

	t.Run("accepts document with empty workflowId", func(t *testing.T) {
		service, err := encryption.GetService()
		require.NoError(t, err)

		legacyEncrypted, err := service.Encrypt("sk-test", nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId":     "user-1",
			"workflowId": "",
			"openai":     map[string]interface{}{"apiKey": legacyEncrypted},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)
	})
}

func TestDocumentMigrator_WorkflowScoping(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	t.Run("migrates workflow-scoped legacy data", func(t *testing.T) {
		legacyEncrypted, err := service.Encrypt("sk-workflow-key", nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId":     "user-1",
			"workflowId": "wf-123",
			"openai":     map[string]interface{}{"apiKey": legacyEncrypted},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		builder := encryption.NewADBuilder()
		ad := builder.BuildForLLMField("user-1", "wf-123", "openai.apiKey")

		migratedCiphertext := doc["openai"].(map[string]interface{})["apiKey"].(string)
		decrypted := verifyDecryptWithAD(t, migratedCiphertext, ad)
		assert.Equal(t, "sk-workflow-key", decrypted)
	})

	t.Run("migrates workflow-scoped array fields", func(t *testing.T) {
		legacyHeaders, err := service.Encrypt(`{"Auth":"Bearer token"}`, nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId":     "user-1",
			"workflowId": "wf-456",
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":   "srv1",
					"headers": legacyHeaders,
				},
			},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		builder := encryption.NewADBuilder()
		ad := builder.BuildForArrayField("user-1", "wf-456", "mcp", "srv1", "headers")

		migratedCiphertext := doc["mcp"].([]interface{})[0].(map[string]interface{})["headers"].(string)
		decrypted := verifyDecryptWithAD(t, migratedCiphertext, ad)
		assert.Equal(t, `{"Auth":"Bearer token"}`, decrypted)
	})
}

func TestDocumentMigrator_MultipleArrayItems(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	t.Run("migrates all items in array with different aliases", func(t *testing.T) {
		headers1, err := service.Encrypt(`{"X-Key-1":"secret1"}`, nil)
		require.NoError(t, err)
		headers2, err := service.Encrypt(`{"X-Key-2":"secret2"}`, nil)
		require.NoError(t, err)
		headers3, err := service.Encrypt(`{"X-Key-3":"secret3"}`, nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"mcp": []interface{}{
				map[string]interface{}{"alias": "srv1", "headers": headers1},
				map[string]interface{}{"alias": "srv2", "headers": headers2},
				map[string]interface{}{"alias": "srv3", "headers": headers3},
			},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		builder := encryption.NewADBuilder()
		mcpItems := doc["mcp"].([]interface{})

		expectedSecrets := []string{`{"X-Key-1":"secret1"}`, `{"X-Key-2":"secret2"}`, `{"X-Key-3":"secret3"}`}
		for i, expectedAlias := range []string{"srv1", "srv2", "srv3"} {
			item := mcpItems[i].(map[string]interface{})
			ad := builder.BuildForArrayField("user-1", "", "mcp", expectedAlias, "headers")
			decrypted := verifyDecryptWithAD(t, item["headers"].(string), ad)
			assert.Equal(t, expectedSecrets[i], decrypted)
		}
	})

	t.Run("migrates mixed legacy and modern items in same array", func(t *testing.T) {
		legacyHeaders, err := service.Encrypt(`{"Legacy":"token"}`, nil)
		require.NoError(t, err)

		builder := encryption.NewADBuilder()
		modernAD := builder.BuildForArrayField("user-1", "", "mcp", "modern", "headers")
		modernHeaders, err := service.Encrypt(`{"Modern":"token"}`, modernAD)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"mcp": []interface{}{
				map[string]interface{}{"alias": "legacy", "headers": legacyHeaders},
				map[string]interface{}{"alias": "modern", "headers": modernHeaders},
			},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		mcpItems := doc["mcp"].([]interface{})

		legacyAD := builder.BuildForArrayField("user-1", "", "mcp", "legacy", "headers")
		legacyDecrypted := verifyDecryptWithAD(t, mcpItems[0].(map[string]interface{})["headers"].(string), legacyAD)
		assert.Equal(t, `{"Legacy":"token"}`, legacyDecrypted)

		modernDecrypted := verifyDecryptWithAD(t, mcpItems[1].(map[string]interface{})["headers"].(string), modernAD)
		assert.Equal(t, `{"Modern":"token"}`, modernDecrypted)
	})
}

func TestDocumentMigrator_EmptyAndMissingFields(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	t.Run("skips document with no encrypted fields", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
			"lang":   "en",
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})

	t.Run("skips document with only plaintext fields", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": "plaintext-key"},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})

	t.Run("handles empty array gracefully", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
			"mcp":    []interface{}{},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})

	t.Run("handles array items without encrypted fields", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":    "srv1",
					"toolName": "test",
				},
			},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})
}

func TestDocumentMigrator_DataIntegrity(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	t.Run("preserves non-encrypted fields during migration", func(t *testing.T) {
		legacyEncrypted, err := service.Encrypt("sk-test", nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId":     "user-1",
			"workflowId": "wf-789",
			"lang":       "en",
			"openai":     map[string]interface{}{"apiKey": legacyEncrypted, "model": "gpt-4"},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		assert.Equal(t, "user-1", doc["userId"])
		assert.Equal(t, "wf-789", doc["workflowId"])
		assert.Equal(t, "en", doc["lang"])
		assert.Equal(t, "gpt-4", doc["openai"].(map[string]interface{})["model"])
	})

	t.Run("preserves array item non-encrypted fields", func(t *testing.T) {
		legacyHeaders, err := service.Encrypt(`{"Auth":"token"}`, nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"mcp": []interface{}{
				map[string]interface{}{
					"alias":     "srv1",
					"headers":   legacyHeaders,
					"transport": "stdio",
					"command":   "/usr/bin/node",
					"serverUrl": "",
				},
			},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)

		item := doc["mcp"].([]interface{})[0].(map[string]interface{})
		assert.Equal(t, "srv1", item["alias"])
		assert.Equal(t, "stdio", item["transport"])
		assert.Equal(t, "/usr/bin/node", item["command"])
		assert.Equal(t, "", item["serverUrl"])
	})

	t.Run("does not modify original document on detection failure", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": "plaintext"},
		}

		originalKey := doc["openai"].(map[string]interface{})["apiKey"]

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)

		assert.Equal(t, originalKey, doc["openai"].(map[string]interface{})["apiKey"])
	})
}

func TestDocumentMigrator_DetectorReuse(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	t.Run("detector instance is reused across multiple documents", func(t *testing.T) {
		docs := make([]map[string]interface{}, 5)
		for i := 0; i < 5; i++ {
			legacyEncrypted, err := service.Encrypt("secret-"+string(rune('A'+i)), nil)
			require.NoError(t, err)

			docs[i] = map[string]interface{}{
				"userId": "user-1",
				"openai": map[string]interface{}{"apiKey": legacyEncrypted},
			}
		}

		for i, doc := range docs {
			migrated, err := migrator.MigrateDocument(doc)
			require.NoError(t, err)
			assert.True(t, migrated, "document %d should be migrated", i)
		}

		require.NotNil(t, migrator.detector, "detector should be initialized")
	})

	t.Run("detector handles mixed detection across multiple documents", func(t *testing.T) {
		builder := encryption.NewADBuilder()

		legacyDoc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": mustEncrypt(t, service, "legacy-key", nil)},
		}

		modernDoc := map[string]interface{}{
			"userId": "user-2",
			"openai": map[string]interface{}{
				"apiKey": mustEncrypt(t, service, "modern-key", builder.BuildForLLMField("user-2", "", "openai.apiKey")),
			},
		}

		plainDoc := map[string]interface{}{
			"userId": "user-3",
			"openai": map[string]interface{}{"apiKey": "plaintext"},
		}

		migrated1, err := migrator.MigrateDocument(legacyDoc)
		require.NoError(t, err)
		assert.True(t, migrated1)

		migrated2, err := migrator.MigrateDocument(modernDoc)
		require.NoError(t, err)
		assert.False(t, migrated2)

		migrated3, err := migrator.MigrateDocument(plainDoc)
		require.NoError(t, err)
		assert.False(t, migrated3)
	})
}

func TestDocumentMigrator_PathNavigation(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	t.Run("handles deeply nested field paths", func(t *testing.T) {
		legacyEncrypted, err := service.Encrypt("deep-secret", nil)
		require.NoError(t, err)

		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": legacyEncrypted},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)
	})

	t.Run("handles single-segment paths", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})

	t.Run("handles documents with no fields matching config", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId":     "user-1",
			"otherField": "value",
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})
}

func TestDocumentMigrator_MarkerBehavior(t *testing.T) {
	migrator, err := NewDocumentMigrator()
	require.NoError(t, err)

	service, err := encryption.GetService()
	require.NoError(t, err)

	t.Run("detects unmarked values correctly", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": "plaintext-without-prefix"},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})

	t.Run("detects marked values correctly", func(t *testing.T) {
		legacyEncrypted, err := service.Encrypt("secret", nil)
		require.NoError(t, err)
		require.NotEmpty(t, legacyEncrypted)

		marker := encryption.NewMarker()
		assert.True(t, marker.IsMarked(legacyEncrypted), "service should return marked ciphertext")

		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": legacyEncrypted},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.True(t, migrated)
	})

	t.Run("handles values containing marker prefix in middle", func(t *testing.T) {
		doc := map[string]interface{}{
			"userId": "user-1",
			"openai": map[string]interface{}{"apiKey": "text__encrypted__middle"},
		}

		migrated, err := migrator.MigrateDocument(doc)
		require.NoError(t, err)
		assert.False(t, migrated)
	})
}

func TestDocumentMigrator_ConcurrentSafety(t *testing.T) {
	t.Run("multiple migrators operate independently", func(t *testing.T) {
		service, err := encryption.GetService()
		require.NoError(t, err)

		concurrency := 5
		done := make(chan bool, concurrency)

		for i := 0; i < concurrency; i++ {
			go func(id int) {
				defer func() { done <- true }()

				migrator, err := NewDocumentMigrator()
				if err != nil {
					t.Errorf("goroutine %d: NewDocumentMigrator failed: %v", id, err)
					return
				}

				legacyEncrypted, err := service.Encrypt("secret", nil)
				if err != nil {
					t.Errorf("goroutine %d: Encrypt failed: %v", id, err)
					return
				}

				doc := map[string]interface{}{
					"userId": "user-1",
					"openai": map[string]interface{}{"apiKey": legacyEncrypted},
				}

				migrated, err := migrator.MigrateDocument(doc)
				if err != nil {
					t.Errorf("goroutine %d: MigrateDocument failed: %v", id, err)
					return
				}

				if !migrated {
					t.Errorf("goroutine %d: expected migration to occur", id)
				}
			}(i)
		}

		for i := 0; i < concurrency; i++ {
			<-done
		}
	})
}

func mustEncrypt(t *testing.T, service *encryption.Service, plaintext string, ad []byte) string {
	t.Helper()
	encrypted, err := service.Encrypt(plaintext, ad)
	require.NoError(t, err)
	return encrypted
}

func verifyDecryptWithAD(t *testing.T, markedCiphertext string, ad []byte) string {
	t.Helper()

	marker := encryption.NewMarker()
	if !marker.IsMarked(markedCiphertext) {
		t.Fatalf("value not marked as encrypted: %s", markedCiphertext)
	}

	ciphertext := marker.Unmark(markedCiphertext)

	cipher := encryption.NewCipher()
	keyDerivation, err := encryption.GetKeyDerivation()
	require.NoError(t, err)

	key := keyDerivation.GetKey()

	plaintext, err := cipher.Decrypt(ciphertext, key, ad)
	require.NoError(t, err, "decrypt with AD should succeed for migrated data")

	return plaintext
}
