package integration

import "backend-v2/internal/common/encryption"

// EncryptionConfig defines which Integration fields to encrypt.
// Mirrors Node.js INTEGRATION_ENCRYPTION_CONFIG.
type EncryptionConfig struct {
	// Simple fields: field path -> encrypt as string
	Fields []string

	// Array fields: array name -> field configs
	ArrayFields map[string][]encryption.FieldConfig
}

// GetIntegrationEncryptionConfig returns encryption configuration for Integration model.
func GetIntegrationEncryptionConfig() *EncryptionConfig {
	return &EncryptionConfig{
		Fields: []string{
			"openai.apiKey",
			"yandex.apiKey",
			"claude.apiKey",
			"perplexity.apiKey",
			"qwen.apiKey",
			"deepseek.apiKey",
			"custom_llm.apiKey",
		},
		ArrayFields: map[string][]encryption.FieldConfig{
			"rpc": {
				{Path: "privateKey", Serialize: false},
				{Path: "passphrase", Serialize: false},
				{Path: "headers", Serialize: true},
				{Path: "env", Serialize: true},
			},
			"mcp": {
				{Path: "headers", Serialize: true},
				{Path: "env", Serialize: true},
			},
		},
	}
}
