package integration

import (
	"backend-v2/internal/models"
	"testing"
)

func TestServiceFieldExtractor_ExtractSecureServiceField_LLMProviders(t *testing.T) {
	redactor := NewSecretRedactor()
	extractor := NewServiceFieldExtractor(redactor)

	tests := []struct {
		name                  string
		integration           *models.Integration
		fieldName             string
		expectFieldNil        bool
		expectSecretRedacted  bool
		expectMetadataPresent bool
	}{
		{
			name: "openai with API key redacts secret and provides metadata",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{
					APIKey: "sk-test-key-12345",
					Model:  "gpt-4",
				},
			},
			fieldName:             "openai",
			expectFieldNil:        false,
			expectSecretRedacted:  true,
			expectMetadataPresent: true,
		},
		{
			name: "openai without API key returns config without metadata",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{
					Model: "gpt-4",
				},
			},
			fieldName:             "openai",
			expectFieldNil:        false,
			expectSecretRedacted:  false,
			expectMetadataPresent: false,
		},
		{
			name: "claude with API key redacts secret",
			integration: &models.Integration{
				Claude: &models.ClaudeConfig{
					APIKey: "sk-ant-12345",
					Model:  "claude-3",
				},
			},
			fieldName:             "claude",
			expectFieldNil:        false,
			expectSecretRedacted:  true,
			expectMetadataPresent: true,
		},
		{
			name: "yandex with API key redacts secret",
			integration: &models.Integration{
				Yandex: &models.YandexConfig{
					APIKey:   "yandex-key-12345",
					FolderID: "folder123",
				},
			},
			fieldName:             "yandex",
			expectFieldNil:        false,
			expectSecretRedacted:  true,
			expectMetadataPresent: true,
		},
		{
			name: "qwen with API key redacts secret",
			integration: &models.Integration{
				Qwen: &models.QwenConfig{
					APIKey: "qwen-key-12345",
				},
			},
			fieldName:             "qwen",
			expectFieldNil:        false,
			expectSecretRedacted:  true,
			expectMetadataPresent: true,
		},
		{
			name: "deepseek with API key redacts secret",
			integration: &models.Integration{
				Deepseek: &models.DeepseekConfig{
					APIKey: "deepseek-key-12345",
				},
			},
			fieldName:             "deepseek",
			expectFieldNil:        false,
			expectSecretRedacted:  true,
			expectMetadataPresent: true,
		},
		{
			name: "perplexity with API key redacts secret",
			integration: &models.Integration{
				Perplexity: &models.PerplexityConfig{
					APIKey: "pplx-key-12345",
				},
			},
			fieldName:             "perplexity",
			expectFieldNil:        false,
			expectSecretRedacted:  true,
			expectMetadataPresent: true,
		},
		{
			name: "custom_llm with API key redacts secret",
			integration: &models.Integration{
				CustomLLM: &models.CustomLLMConfig{
					APIKey:     "custom-key-12345",
					APIRootURL: "https://custom.api.com",
				},
			},
			fieldName:             "custom_llm",
			expectFieldNil:        false,
			expectSecretRedacted:  true,
			expectMetadataPresent: true,
		},
		{
			name:           "nonexistent field returns nil",
			integration:    &models.Integration{},
			fieldName:      "nonexistent",
			expectFieldNil: true,
		},
		{
			name: "field exists in integration but user has different provider",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{APIKey: "sk-test"},
			},
			fieldName:      "claude",
			expectFieldNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := extractor.ExtractSecureServiceField(tt.integration, tt.fieldName)
			if err != nil {
				t.Fatalf("ExtractSecureServiceField failed: %v", err)
			}

			fieldValue, exists := result[tt.fieldName]
			if !exists {
				t.Fatalf("Expected field '%s' in result, got keys: %v", tt.fieldName, result)
			}

			if tt.expectFieldNil {
				if fieldValue != nil {
					t.Errorf("Expected nil field value, got: %v", fieldValue)
				}
				return
			}

			if fieldValue == nil {
				t.Errorf("Expected non-nil field value")
				return
			}

			fieldMap, ok := fieldValue.(map[string]interface{})
			if !ok {
				t.Errorf("Expected field value to be map[string]interface{}, got %T", fieldValue)
				return
			}

			if tt.expectSecretRedacted {
				apiKey, hasKey := fieldMap["apiKey"]
				if hasKey && apiKey != "" {
					t.Errorf("Expected empty or omitted apiKey (redacted), got: %v", apiKey)
				}
			}

			secretsMeta, hasSecretsMeta := result["secretsMeta"]
			if tt.expectMetadataPresent {
				if !hasSecretsMeta {
					t.Errorf("Expected secretsMeta in response")
				} else if secretsMeta == nil {
					t.Errorf("Expected non-nil secretsMeta")
				}
			} else {
				if hasSecretsMeta && secretsMeta != nil {
					t.Errorf("Expected no secretsMeta, got: %v", secretsMeta)
				}
			}
		})
	}
}

func TestServiceFieldExtractor_ExtractSecureServiceField_ArrayIntegrations(t *testing.T) {
	redactor := NewSecretRedactor()
	extractor := NewServiceFieldExtractor(redactor)

	tests := []struct {
		name                  string
		integration           *models.Integration
		fieldName             string
		expectItemCount       int
		expectMetadataPresent bool
	}{
		{
			name: "mcp array with secrets provides metadata",
			integration: &models.Integration{
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:     "/research",
						Command:   "npx",
						Transport: "stdio",
						Headers:   map[string]string{"Authorization": "Bearer token"},
					},
				},
			},
			fieldName:             "mcp",
			expectItemCount:       1,
			expectMetadataPresent: true,
		},
		{
			name: "rpc array with secrets provides metadata",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:      "/coder",
						Protocol:   "ssh",
						Host:       "192.168.1.100",
						PrivateKey: "ssh-rsa AAAA...",
					},
				},
			},
			fieldName:             "rpc",
			expectItemCount:       1,
			expectMetadataPresent: true,
		},
		{
			name: "empty mcp array returns empty array",
			integration: &models.Integration{
				MCP: []models.MCPIntegrationConfig{},
			},
			fieldName:             "mcp",
			expectItemCount:       0,
			expectMetadataPresent: false,
		},
		{
			name: "mcp array without secrets returns array without metadata",
			integration: &models.Integration{
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:     "/plain",
						Command:   "echo",
						Transport: "stdio",
					},
				},
			},
			fieldName:             "mcp",
			expectItemCount:       1,
			expectMetadataPresent: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := extractor.ExtractSecureServiceField(tt.integration, tt.fieldName)
			if err != nil {
				t.Fatalf("ExtractSecureServiceField failed: %v", err)
			}

			fieldValue, exists := result[tt.fieldName]
			if !exists {
				t.Fatalf("Expected field '%s' in result", tt.fieldName)
			}

			if fieldValue == nil && tt.expectItemCount == 0 {
				return
			}

			items, ok := fieldValue.([]interface{})
			if !ok {
				t.Errorf("Expected array field value, got %T", fieldValue)
				return
			}

			if len(items) != tt.expectItemCount {
				t.Errorf("Expected %d items, got %d", tt.expectItemCount, len(items))
			}

			secretsMeta, hasSecretsMeta := result["secretsMeta"]
			if tt.expectMetadataPresent {
				if !hasSecretsMeta {
					t.Errorf("Expected secretsMeta in response")
				}
			} else {
				if hasSecretsMeta && secretsMeta != nil {
					t.Errorf("Expected no secretsMeta, got: %v", secretsMeta)
				}
			}
		})
	}
}

func TestServiceFieldExtractor_ExtractSecureServiceField_EdgeCases(t *testing.T) {
	redactor := NewSecretRedactor()
	extractor := NewServiceFieldExtractor(redactor)

	tests := []struct {
		name        string
		integration *models.Integration
		fieldName   string
		expectError bool
	}{
		{
			name:        "empty integration returns nil field",
			integration: &models.Integration{},
			fieldName:   "openai",
			expectError: false,
		},
		{
			name: "integration with multiple providers extracts only requested",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{APIKey: "sk-openai"},
				Claude: &models.ClaudeConfig{APIKey: "sk-claude"},
			},
			fieldName:   "openai",
			expectError: false,
		},
		{
			name: "lang and model fields are not secret",
			integration: &models.Integration{
				Lang:  "en",
				Model: "auto",
			},
			fieldName:   "lang",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := extractor.ExtractSecureServiceField(tt.integration, tt.fieldName)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("Expected no error, got: %v", err)
			}

			if result == nil {
				t.Fatalf("Expected non-nil result")
			}

			if _, exists := result[tt.fieldName]; !exists {
				t.Errorf("Expected field '%s' in result", tt.fieldName)
			}
		})
	}
}

func TestServiceFieldExtractor_SecretRedaction_Idempotency(t *testing.T) {
	redactor := NewSecretRedactor()
	extractor := NewServiceFieldExtractor(redactor)

	integration := &models.Integration{
		OpenAI: &models.OpenAIConfig{
			APIKey: "sk-original-key",
			Model:  "gpt-4",
		},
	}

	result1, err := extractor.ExtractSecureServiceField(integration, "openai")
	if err != nil {
		t.Fatalf("First extraction failed: %v", err)
	}

	openai1 := result1["openai"].(map[string]interface{})
	if openai1["apiKey"] != "" {
		t.Errorf("First extraction: expected empty apiKey, got: %v", openai1["apiKey"])
	}

	result2, err := extractor.ExtractSecureServiceField(integration, "openai")
	if err != nil {
		t.Fatalf("Second extraction failed: %v", err)
	}

	openai2 := result2["openai"].(map[string]interface{})
	if openai2["apiKey"] != "" {
		t.Errorf("Second extraction: expected empty apiKey, got: %v", openai2["apiKey"])
	}
}
