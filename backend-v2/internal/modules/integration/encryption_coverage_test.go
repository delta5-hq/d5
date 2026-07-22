package integration_test

import (
	"backend-v2/internal/modules/integration"
	"testing"
)

func TestEncryptionConfigCoverage(t *testing.T) {
	config := integration.GetIntegrationEncryptionConfig()

	t.Run("RPC array has all required encrypted fields", func(t *testing.T) {
		rpcFields, exists := config.ArrayFields["rpc"]
		if !exists {
			t.Fatal("RPC array fields not configured")
		}

		expectedFields := map[string]bool{
			"privateKey": false,
			"passphrase": false,
			"headers":    true,
			"env":        true,
		}

		if len(rpcFields) != len(expectedFields) {
			t.Errorf("Expected %d RPC encrypted fields, got %d", len(expectedFields), len(rpcFields))
		}

		for _, field := range rpcFields {
			expectedSerialize, exists := expectedFields[field.Path]
			if !exists {
				t.Errorf("Unexpected encrypted field: %s", field.Path)
				continue
			}
			if field.Serialize != expectedSerialize {
				t.Errorf("Field %s: Serialize = %v, want %v", field.Path, field.Serialize, expectedSerialize)
			}
		}
	})

	t.Run("MCP array has all required encrypted fields", func(t *testing.T) {
		mcpFields, exists := config.ArrayFields["mcp"]
		if !exists {
			t.Fatal("MCP array fields not configured")
		}

		expectedFields := map[string]bool{
			"headers": true,
			"env":     true,
		}

		if len(mcpFields) != len(expectedFields) {
			t.Errorf("Expected %d MCP encrypted fields, got %d", len(expectedFields), len(mcpFields))
		}

		for _, field := range mcpFields {
			expectedSerialize, exists := expectedFields[field.Path]
			if !exists {
				t.Errorf("Unexpected encrypted field: %s", field.Path)
				continue
			}
			if field.Serialize != expectedSerialize {
				t.Errorf("Field %s: Serialize = %v, want %v", field.Path, field.Serialize, expectedSerialize)
			}
		}
	})

	t.Run("All LLM provider fields are configured", func(t *testing.T) {
		expectedFields := []string{
			"openai.apiKey",
			"yandex.apiKey",
			"claude.apiKey",
			"perplexity.apiKey",
			"qwen.apiKey",
			"deepseek.apiKey",
			"custom_llm.apiKey",
		}

		if len(config.Fields) != len(expectedFields) {
			t.Errorf("Expected %d LLM fields, got %d", len(expectedFields), len(config.Fields))
		}

		fieldMap := make(map[string]bool)
		for _, field := range config.Fields {
			fieldMap[field] = true
		}

		for _, expected := range expectedFields {
			if !fieldMap[expected] {
				t.Errorf("Missing LLM field: %s", expected)
			}
		}
	})

	t.Run("Encrypted fields are consistently defined across components", func(t *testing.T) {
		if len(config.ArrayFields) < 2 {
			t.Error("Expected at least 2 array field configs (rpc, mcp)")
		}

		for arrayName, fields := range config.ArrayFields {
			if len(fields) == 0 {
				t.Errorf("Array %s has no encrypted fields configured", arrayName)
			}
			for _, field := range fields {
				if field.Path == "" {
					t.Errorf("Array %s has field with empty Path", arrayName)
				}
			}
		}
	})
}
