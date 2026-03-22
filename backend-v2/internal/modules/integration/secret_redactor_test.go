package integration

import (
	"backend-v2/internal/models"
	"testing"
)

func TestSecretRedactor_BuildMetadata_LLMProviders(t *testing.T) {
	redactor := NewSecretRedactor()

	tests := []struct {
		name              string
		integration       *models.Integration
		expectMetaPresent map[string]bool
	}{
		{
			name:              "empty integration produces no metadata",
			integration:       &models.Integration{},
			expectMetaPresent: map[string]bool{},
		},
		{
			name: "single provider with API key",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{APIKey: "sk-test"},
			},
			expectMetaPresent: map[string]bool{"openai": true},
		},
		{
			name: "all LLM providers with API keys",
			integration: &models.Integration{
				OpenAI:     &models.OpenAIConfig{APIKey: "sk-openai"},
				Yandex:     &models.YandexConfig{APIKey: "yandex-key"},
				Claude:     &models.ClaudeConfig{APIKey: "claude-key"},
				Qwen:       &models.QwenConfig{APIKey: "qwen-key"},
				Deepseek:   &models.DeepseekConfig{APIKey: "deepseek-key"},
				CustomLLM:  &models.CustomLLMConfig{APIKey: "custom-key"},
				Perplexity: &models.PerplexityConfig{APIKey: "perplexity-key"},
			},
			expectMetaPresent: map[string]bool{
				"openai": true, "yandex": true, "claude": true,
				"qwen": true, "deepseek": true, "custom_llm": true, "perplexity": true,
			},
		},
		{
			name: "provider exists but no API key",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{Model: "gpt-4"},
			},
			expectMetaPresent: map[string]bool{},
		},
		{
			name: "mixed presence and absence",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{APIKey: "sk-test"},
				Claude: &models.ClaudeConfig{Model: "claude-3"},
			},
			expectMetaPresent: map[string]bool{"openai": true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta := redactor.BuildMetadataFromIntegration(tt.integration)

			providers := map[string]*models.LLMSecretMetadata{
				"openai":     meta.OpenAI,
				"yandex":     meta.Yandex,
				"claude":     meta.Claude,
				"qwen":       meta.Qwen,
				"deepseek":   meta.Deepseek,
				"custom_llm": meta.CustomLLM,
				"perplexity": meta.Perplexity,
			}

			for provider, shouldExist := range tt.expectMetaPresent {
				providerMeta := providers[provider]
				if shouldExist {
					if providerMeta == nil || !providerMeta.APIKey {
						t.Errorf("Expected %s metadata with APIKey=true, got %v", provider, providerMeta)
					}
				} else {
					if providerMeta != nil {
						t.Errorf("Expected nil %s metadata, got %v", provider, providerMeta)
					}
				}
			}

			for provider, providerMeta := range providers {
				if _, expected := tt.expectMetaPresent[provider]; !expected {
					if providerMeta != nil {
						t.Errorf("Unexpected %s metadata: %v", provider, providerMeta)
					}
				}
			}
		})
	}
}

func TestSecretRedactor_BuildMetadata_ArrayIntegrations(t *testing.T) {
	redactor := NewSecretRedactor()

	tests := []struct {
		name            string
		integration     *models.Integration
		expectRPCMeta   map[string]map[string]bool
		expectMCPMeta   map[string]map[string]bool
		expectNoRPCMeta bool
		expectNoMCPMeta bool
	}{
		{
			name:            "no array integrations",
			integration:     &models.Integration{},
			expectNoRPCMeta: true,
			expectNoMCPMeta: true,
		},
		{
			name: "RPC with all secret fields",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:      "deploy",
						PrivateKey: "ssh-rsa ...",
						Passphrase: "secret",
						Headers:    map[string]string{"Auth": "Bearer xyz"},
						Env:        map[string]string{"DB_PASS": "dbsecret"},
					},
				},
			},
			expectRPCMeta: map[string]map[string]bool{
				"deploy": {"privateKey": true, "passphrase": true, "headers": true, "env": true},
			},
			expectNoMCPMeta: true,
		},
		{
			name: "RPC with partial secrets",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:      "onlyKey",
						PrivateKey: "key",
					},
					{
						Alias:   "onlyHeaders",
						Headers: map[string]string{"X-Token": "abc"},
					},
				},
			},
			expectRPCMeta: map[string]map[string]bool{
				"onlyKey":     {"privateKey": true},
				"onlyHeaders": {"headers": true},
			},
			expectNoMCPMeta: true,
		},
		{
			name: "RPC without secrets",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:    "noSecrets",
						Host:     "example.com",
						Protocol: "ssh",
					},
				},
			},
			expectNoRPCMeta: true,
			expectNoMCPMeta: true,
		},
		{
			name: "MCP with headers and env",
			integration: &models.Integration{
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:   "agent",
						Headers: map[string]string{"X-API-Key": "secret"},
						Env:     map[string]string{"TOKEN": "abc"},
					},
				},
			},
			expectMCPMeta: map[string]map[string]bool{
				"agent": {"headers": true, "env": true},
			},
			expectNoRPCMeta: true,
		},
		{
			name: "MCP with only headers",
			integration: &models.Integration{
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:   "onlyHeaders",
						Headers: map[string]string{"Auth": "token"},
					},
				},
			},
			expectMCPMeta: map[string]map[string]bool{
				"onlyHeaders": {"headers": true},
			},
			expectNoRPCMeta: true,
		},
		{
			name: "MCP without secrets",
			integration: &models.Integration{
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:     "noSecrets",
						ToolName:  "test",
						Transport: "stdio",
					},
				},
			},
			expectNoRPCMeta: true,
			expectNoMCPMeta: true,
		},
		{
			name: "multiple aliases with mixed secrets",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{Alias: "full", PrivateKey: "key", Passphrase: "pass", Headers: map[string]string{"a": "b"}},
					{Alias: "partial", PrivateKey: "key"},
					{Alias: "none", Host: "example.com"},
				},
				MCP: []models.MCPIntegrationConfig{
					{Alias: "mcpFull", Headers: map[string]string{"a": "b"}, Env: map[string]string{"c": "d"}},
					{Alias: "mcpNone", ToolName: "test"},
				},
			},
			expectRPCMeta: map[string]map[string]bool{
				"full":    {"privateKey": true, "passphrase": true, "headers": true},
				"partial": {"privateKey": true},
			},
			expectMCPMeta: map[string]map[string]bool{
				"mcpFull": {"headers": true, "env": true},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			meta := redactor.BuildMetadataFromIntegration(tt.integration)

			if tt.expectNoRPCMeta {
				if meta.RPC != nil {
					t.Errorf("Expected nil RPC metadata, got %v", meta.RPC)
				}
			} else {
				if meta.RPC == nil {
					t.Fatal("Expected RPC metadata map, got nil")
				}
				for alias, expectedFields := range tt.expectRPCMeta {
					aliasMeta, exists := meta.RPC[alias]
					if !exists {
						t.Fatalf("Expected metadata for RPC alias '%s'", alias)
					}
					verifyArrayItemMetadata(t, "RPC", alias, aliasMeta, expectedFields)
				}
				for alias := range meta.RPC {
					if _, expected := tt.expectRPCMeta[alias]; !expected {
						t.Errorf("Unexpected RPC metadata for alias '%s'", alias)
					}
				}
			}

			if tt.expectNoMCPMeta {
				if meta.MCP != nil {
					t.Errorf("Expected nil MCP metadata, got %v", meta.MCP)
				}
			} else {
				if meta.MCP == nil {
					t.Fatal("Expected MCP metadata map, got nil")
				}
				for alias, expectedFields := range tt.expectMCPMeta {
					aliasMeta, exists := meta.MCP[alias]
					if !exists {
						t.Fatalf("Expected metadata for MCP alias '%s'", alias)
					}
					verifyArrayItemMetadata(t, "MCP", alias, aliasMeta, expectedFields)
				}
				for alias := range meta.MCP {
					if _, expected := tt.expectMCPMeta[alias]; !expected {
						t.Errorf("Unexpected MCP metadata for alias '%s'", alias)
					}
				}
			}
		})
	}
}

func TestSecretRedactor_Redaction_LLMProviders(t *testing.T) {
	redactor := NewSecretRedactor()

	tests := []struct {
		name                  string
		integration           *models.Integration
		verifySecretsCleared  map[string]func(*models.Integration) bool
		verifyConfigPreserved map[string]func(*models.Integration) bool
	}{
		{
			name: "all LLM providers",
			integration: &models.Integration{
				OpenAI:     &models.OpenAIConfig{APIKey: "sk-test", Model: "gpt-4"},
				Yandex:     &models.YandexConfig{APIKey: "yandex-key", FolderID: "folder123", Model: "yandex-model"},
				Claude:     &models.ClaudeConfig{APIKey: "claude-key", Model: "claude-3"},
				Qwen:       &models.QwenConfig{APIKey: "qwen-key", Model: "qwen-model"},
				Deepseek:   &models.DeepseekConfig{APIKey: "deepseek-key", Model: "deepseek-model"},
				CustomLLM:  &models.CustomLLMConfig{APIKey: "custom-key", APIRootURL: "https://api.example.com"},
				Perplexity: &models.PerplexityConfig{APIKey: "perplexity-key", Model: "perplexity-model"},
			},
			verifySecretsCleared: map[string]func(*models.Integration) bool{
				"openai.apiKey":     func(i *models.Integration) bool { return i.OpenAI.APIKey == "" },
				"yandex.apiKey":     func(i *models.Integration) bool { return i.Yandex.APIKey == "" },
				"claude.apiKey":     func(i *models.Integration) bool { return i.Claude.APIKey == "" },
				"qwen.apiKey":       func(i *models.Integration) bool { return i.Qwen.APIKey == "" },
				"deepseek.apiKey":   func(i *models.Integration) bool { return i.Deepseek.APIKey == "" },
				"custom_llm.apiKey": func(i *models.Integration) bool { return i.CustomLLM.APIKey == "" },
				"perplexity.apiKey": func(i *models.Integration) bool { return i.Perplexity.APIKey == "" },
			},
			verifyConfigPreserved: map[string]func(*models.Integration) bool{
				"openai.model":          func(i *models.Integration) bool { return i.OpenAI.Model == "gpt-4" },
				"yandex.folder_id":      func(i *models.Integration) bool { return i.Yandex.FolderID == "folder123" },
				"yandex.model":          func(i *models.Integration) bool { return i.Yandex.Model == "yandex-model" },
				"claude.model":          func(i *models.Integration) bool { return i.Claude.Model == "claude-3" },
				"qwen.model":            func(i *models.Integration) bool { return i.Qwen.Model == "qwen-model" },
				"deepseek.model":        func(i *models.Integration) bool { return i.Deepseek.Model == "deepseek-model" },
				"custom_llm.apiRootUrl": func(i *models.Integration) bool { return i.CustomLLM.APIRootURL == "https://api.example.com" },
				"perplexity.model":      func(i *models.Integration) bool { return i.Perplexity.Model == "perplexity-model" },
			},
		},
		{
			name: "empty API keys remain empty",
			integration: &models.Integration{
				OpenAI: &models.OpenAIConfig{Model: "gpt-4"},
			},
			verifySecretsCleared: map[string]func(*models.Integration) bool{
				"openai.apiKey": func(i *models.Integration) bool { return i.OpenAI.APIKey == "" },
			},
			verifyConfigPreserved: map[string]func(*models.Integration) bool{
				"openai.model": func(i *models.Integration) bool { return i.OpenAI.Model == "gpt-4" },
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			redactor.RedactSecretsFromIntegration(tt.integration)

			for field, check := range tt.verifySecretsCleared {
				if !check(tt.integration) {
					t.Errorf("Secret not cleared: %s", field)
				}
			}

			for field, check := range tt.verifyConfigPreserved {
				if !check(tt.integration) {
					t.Errorf("Config not preserved: %s", field)
				}
			}
		})
	}
}

func TestSecretRedactor_Redaction_ArrayIntegrations(t *testing.T) {
	redactor := NewSecretRedactor()

	tests := []struct {
		name        string
		integration *models.Integration
		verifyRPC   func(t *testing.T, rpc []models.RPCIntegrationConfig)
		verifyMCP   func(t *testing.T, mcp []models.MCPIntegrationConfig)
	}{
		{
			name: "RPC all secret fields cleared",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:      "deploy",
						Host:       "10.0.0.1",
						Port:       intPtr(22),
						PrivateKey: "ssh-rsa ...",
						Passphrase: "secret",
						Headers:    map[string]string{"Auth": "Bearer xyz"},
						Env:        map[string]string{"DB_PASS": "dbsecret"},
					},
				},
			},
			verifyRPC: func(t *testing.T, rpc []models.RPCIntegrationConfig) {
				if len(rpc) != 1 {
					t.Fatalf("Expected 1 RPC item, got %d", len(rpc))
				}
				item := rpc[0]
				if item.PrivateKey != "" {
					t.Error("PrivateKey not cleared")
				}
				if item.Passphrase != "" {
					t.Error("Passphrase not cleared")
				}
				if item.Headers != nil {
					t.Error("Headers not nil")
				}
				if item.Env != nil {
					t.Error("Env not nil")
				}
				if item.Host != "10.0.0.1" {
					t.Error("Host config changed")
				}
				if item.Port == nil || *item.Port != 22 {
					t.Error("Port config changed")
				}
				if item.Alias != "deploy" {
					t.Error("Alias changed")
				}
			},
		},
		{
			name: "MCP headers and env cleared",
			integration: &models.Integration{
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:     "agent",
						ServerURL: "https://mcp.example.com",
						Headers:   map[string]string{"X-API-Key": "secret"},
						Env:       map[string]string{"TOKEN": "abc"},
						ToolName:  "execute",
						Transport: "http",
					},
				},
			},
			verifyMCP: func(t *testing.T, mcp []models.MCPIntegrationConfig) {
				if len(mcp) != 1 {
					t.Fatalf("Expected 1 MCP item, got %d", len(mcp))
				}
				item := mcp[0]
				if item.Headers != nil {
					t.Error("Headers not nil")
				}
				if item.Env != nil {
					t.Error("Env not nil")
				}
				if item.ServerURL != "https://mcp.example.com" {
					t.Error("ServerURL changed")
				}
				if item.ToolName != "execute" {
					t.Error("ToolName changed")
				}
				if item.Transport != "http" {
					t.Error("Transport changed")
				}
			},
		},
		{
			name: "multiple items all redacted",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{Alias: "rpc1", PrivateKey: "key1", Host: "host1"},
					{Alias: "rpc2", Passphrase: "pass2", Host: "host2"},
				},
				MCP: []models.MCPIntegrationConfig{
					{Alias: "mcp1", Headers: map[string]string{"a": "b"}, ToolName: "tool1"},
					{Alias: "mcp2", Env: map[string]string{"c": "d"}, ToolName: "tool2"},
				},
			},
			verifyRPC: func(t *testing.T, rpc []models.RPCIntegrationConfig) {
				if len(rpc) != 2 {
					t.Fatalf("Expected 2 RPC items, got %d", len(rpc))
				}
				for _, item := range rpc {
					if item.PrivateKey != "" || item.Passphrase != "" || item.Headers != nil || item.Env != nil {
						t.Errorf("Secrets not cleared for RPC alias %s", item.Alias)
					}
					if item.Host == "" {
						t.Errorf("Config lost for RPC alias %s", item.Alias)
					}
				}
			},
			verifyMCP: func(t *testing.T, mcp []models.MCPIntegrationConfig) {
				if len(mcp) != 2 {
					t.Fatalf("Expected 2 MCP items, got %d", len(mcp))
				}
				for _, item := range mcp {
					if item.Headers != nil || item.Env != nil {
						t.Errorf("Secrets not cleared for MCP alias %s", item.Alias)
					}
					if item.ToolName == "" {
						t.Errorf("Config lost for MCP alias %s", item.Alias)
					}
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			redactor.RedactSecretsFromIntegration(tt.integration)

			if tt.verifyRPC != nil {
				tt.verifyRPC(t, tt.integration.RPC)
			}
			if tt.verifyMCP != nil {
				tt.verifyMCP(t, tt.integration.MCP)
			}
		})
	}
}

func TestSecretRedactor_Idempotency(t *testing.T) {
	redactor := NewSecretRedactor()

	integration := &models.Integration{
		OpenAI: &models.OpenAIConfig{APIKey: "sk-test", Model: "gpt-4"},
		RPC: []models.RPCIntegrationConfig{
			{Alias: "deploy", PrivateKey: "key", Host: "example.com"},
		},
	}

	redactor.RedactSecretsFromIntegration(integration)
	firstPass := copyIntegration(integration)

	redactor.RedactSecretsFromIntegration(integration)
	secondPass := copyIntegration(integration)

	if firstPass.OpenAI.APIKey != secondPass.OpenAI.APIKey {
		t.Error("Redaction not idempotent for OpenAI.APIKey")
	}
	if firstPass.RPC[0].PrivateKey != secondPass.RPC[0].PrivateKey {
		t.Error("Redaction not idempotent for RPC.PrivateKey")
	}
}

func verifyArrayItemMetadata(t *testing.T, arrayType, alias string, meta *models.ArrayItemSecretMetadata, expectedFields map[string]bool) {
	t.Helper()

	actualFields := map[string]bool{
		"privateKey": meta.PrivateKey,
		"passphrase": meta.Passphrase,
		"headers":    meta.Headers,
		"env":        meta.Env,
	}

	for field, shouldBeTrue := range expectedFields {
		if actualFields[field] != shouldBeTrue {
			t.Errorf("%s[%s].%s: expected %v, got %v", arrayType, alias, field, shouldBeTrue, actualFields[field])
		}
	}

	for field, isTrue := range actualFields {
		if isTrue {
			if _, expected := expectedFields[field]; !expected {
				t.Errorf("%s[%s].%s: unexpected true value", arrayType, alias, field)
			}
		}
	}
}

func copyIntegration(src *models.Integration) *models.Integration {
	dst := &models.Integration{}
	if src.OpenAI != nil {
		dst.OpenAI = &models.OpenAIConfig{
			APIKey: src.OpenAI.APIKey,
			Model:  src.OpenAI.Model,
		}
	}
	if len(src.RPC) > 0 {
		dst.RPC = make([]models.RPCIntegrationConfig, len(src.RPC))
		for i, item := range src.RPC {
			dst.RPC[i] = models.RPCIntegrationConfig{
				Alias:      item.Alias,
				PrivateKey: item.PrivateKey,
				Host:       item.Host,
			}
		}
	}
	return dst
}

func intPtr(i int) *int {
	return &i
}
