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
			name: "RPC credential fields cleared but config maps preserved",
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
				if item.PrivateKey != SecretRedactionSentinel {
					t.Errorf("PrivateKey expected sentinel %q, got %q", SecretRedactionSentinel, item.PrivateKey)
				}
				if item.Passphrase != SecretRedactionSentinel {
					t.Errorf("Passphrase expected sentinel %q, got %q", SecretRedactionSentinel, item.Passphrase)
				}
				if item.Headers == nil || item.Headers["Auth"] != "Bearer xyz" {
					t.Error("Headers config map not preserved")
				}
				if item.Env == nil || item.Env["DB_PASS"] != "dbsecret" {
					t.Error("Env config map not preserved")
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
			name: "MCP config maps preserved",
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
				if item.Headers == nil || item.Headers["X-API-Key"] != "secret" {
					t.Error("Headers config map not preserved")
				}
				if item.Env == nil || item.Env["TOKEN"] != "abc" {
					t.Error("Env config map not preserved")
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
			name: "multiple items credentials cleared config maps preserved",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{Alias: "rpc1", PrivateKey: "key1", Host: "host1", Headers: map[string]string{"X-Auth": "token1"}},
					{Alias: "rpc2", Passphrase: "pass2", Host: "host2", Env: map[string]string{"API_KEY": "secret2"}},
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
				if rpc[0].PrivateKey != SecretRedactionSentinel {
					t.Errorf("rpc1 PrivateKey expected sentinel %q, got %q", SecretRedactionSentinel, rpc[0].PrivateKey)
				}
				if rpc[0].Headers == nil || rpc[0].Headers["X-Auth"] != "token1" {
					t.Error("rpc1 Headers config map not preserved")
				}
				if rpc[1].Passphrase != SecretRedactionSentinel {
					t.Errorf("rpc2 Passphrase expected sentinel %q, got %q", SecretRedactionSentinel, rpc[1].Passphrase)
				}
				if rpc[1].Env == nil || rpc[1].Env["API_KEY"] != "secret2" {
					t.Error("rpc2 Env config map not preserved")
				}
				for _, item := range rpc {
					if item.Host == "" {
						t.Errorf("Config lost for RPC alias %s", item.Alias)
					}
				}
			},
			verifyMCP: func(t *testing.T, mcp []models.MCPIntegrationConfig) {
				if len(mcp) != 2 {
					t.Fatalf("Expected 2 MCP items, got %d", len(mcp))
				}
				if mcp[0].Headers == nil || mcp[0].Headers["a"] != "b" {
					t.Error("mcp1 Headers config map not preserved")
				}
				if mcp[1].Env == nil || mcp[1].Env["c"] != "d" {
					t.Error("mcp2 Env config map not preserved")
				}
				for _, item := range mcp {
					if item.ToolName == "" {
						t.Errorf("Config lost for MCP alias %s", item.Alias)
					}
				}
			},
		},
		{
			name: "empty config maps preserved as empty not null",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:      "empty-maps",
						Host:       "example.com",
						PrivateKey: "key",
						Headers:    map[string]string{},
						Env:        map[string]string{},
					},
				},
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:    "empty-mcp",
						ToolName: "test",
						Headers:  map[string]string{},
						Env:      map[string]string{},
					},
				},
			},
			verifyRPC: func(t *testing.T, rpc []models.RPCIntegrationConfig) {
				if len(rpc) != 1 {
					t.Fatalf("Expected 1 RPC item, got %d", len(rpc))
				}
				item := rpc[0]
				if item.PrivateKey != SecretRedactionSentinel {
					t.Errorf("PrivateKey expected sentinel %q, got %q", SecretRedactionSentinel, item.PrivateKey)
				}
				if item.Headers == nil {
					t.Error("Empty Headers became nil instead of empty map")
				}
				if len(item.Headers) != 0 {
					t.Errorf("Expected empty Headers map, got %d entries", len(item.Headers))
				}
				if item.Env == nil {
					t.Error("Empty Env became nil instead of empty map")
				}
				if len(item.Env) != 0 {
					t.Errorf("Expected empty Env map, got %d entries", len(item.Env))
				}
			},
			verifyMCP: func(t *testing.T, mcp []models.MCPIntegrationConfig) {
				if len(mcp) != 1 {
					t.Fatalf("Expected 1 MCP item, got %d", len(mcp))
				}
				item := mcp[0]
				if item.Headers == nil {
					t.Error("Empty Headers became nil instead of empty map")
				}
				if item.Env == nil {
					t.Error("Empty Env became nil instead of empty map")
				}
			},
		},
		{
			name: "nil config maps remain nil",
			integration: &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:      "nil-maps",
						Host:       "example.com",
						PrivateKey: "key",
						Headers:    nil,
						Env:        nil,
					},
				},
				MCP: []models.MCPIntegrationConfig{
					{
						Alias:    "nil-mcp",
						ToolName: "test",
						Headers:  nil,
						Env:      nil,
					},
				},
			},
			verifyRPC: func(t *testing.T, rpc []models.RPCIntegrationConfig) {
				if len(rpc) != 1 {
					t.Fatalf("Expected 1 RPC item, got %d", len(rpc))
				}
				item := rpc[0]
				if item.PrivateKey != SecretRedactionSentinel {
					t.Errorf("PrivateKey expected sentinel %q, got %q", SecretRedactionSentinel, item.PrivateKey)
				}
				if item.Headers != nil {
					t.Error("nil Headers became non-nil")
				}
				if item.Env != nil {
					t.Error("nil Env became non-nil")
				}
			},
			verifyMCP: func(t *testing.T, mcp []models.MCPIntegrationConfig) {
				if len(mcp) != 1 {
					t.Fatalf("Expected 1 MCP item, got %d", len(mcp))
				}
				item := mcp[0]
				if item.Headers != nil {
					t.Error("nil Headers became non-nil")
				}
				if item.Env != nil {
					t.Error("nil Env became non-nil")
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
	if firstPass.RPC[0].PrivateKey != SecretRedactionSentinel {
		t.Errorf("RPC.PrivateKey should be sentinel after redaction, got %q", firstPass.RPC[0].PrivateKey)
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
