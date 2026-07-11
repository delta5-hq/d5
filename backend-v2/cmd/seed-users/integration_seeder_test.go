package main

import (
	"testing"
)

func TestLLMProviderConfig_HasAnyProvider(t *testing.T) {
	tests := []struct {
		name string
		cfg  llmProviderConfig
		want bool
	}{
		{
			name: "empty config has no providers",
			cfg:  llmProviderConfig{},
			want: false,
		},
		{
			name: "openai key present",
			cfg:  llmProviderConfig{openaiAPIKey: "sk-test"},
			want: true,
		},
		{
			name: "claude key present",
			cfg:  llmProviderConfig{claudeAPIKey: "sk-ant-test"},
			want: true,
		},
		{
			name: "deepseek key present",
			cfg:  llmProviderConfig{deepseekAPIKey: "sk-ds-test"},
			want: true,
		},
		{
			name: "qwen key present",
			cfg:  llmProviderConfig{qwenAPIKey: "sk-qwen-test"},
			want: true,
		},
		{
			name: "custom llm url without key is still a provider",
			cfg:  llmProviderConfig{customLLMAPIRootURL: "http://llm.example.com/v1"},
			want: true,
		},
		{
			name: "custom llm key alone without url is not a provider",
			cfg:  llmProviderConfig{customLLMAPIKey: "sk-custom"},
			want: false,
		},
		{
			name: "multiple providers present",
			cfg: llmProviderConfig{
				openaiAPIKey: "sk-openai",
				claudeAPIKey: "sk-claude",
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.cfg.hasAnyProvider()
			if got != tt.want {
				t.Errorf("hasAnyProvider() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestLLMProviderConfig_BuildRawDocument(t *testing.T) {
	t.Run("always includes scalar metadata fields", func(t *testing.T) {
		cfg := llmProviderConfig{openaiAPIKey: "sk-test"}
		doc := cfg.buildRawDocument("admin")

		assertDocField(t, doc, "userId", "admin")
		assertDocField(t, doc, "lang", "none")
		assertDocField(t, doc, "model", "auto")
		assertDocFieldNil(t, doc, "workflowId")
	})

	t.Run("openai sub-document contains apiKey and default model", func(t *testing.T) {
		cfg := llmProviderConfig{openaiAPIKey: "sk-openai-test"}
		doc := cfg.buildRawDocument("admin")

		openai, ok := doc["openai"].(map[string]interface{})
		if !ok {
			t.Fatal("expected openai sub-document")
		}
		if openai["apiKey"] != "sk-openai-test" {
			t.Errorf("openai.apiKey = %v, want sk-openai-test", openai["apiKey"])
		}
		if openai["model"] == "" {
			t.Error("openai.model should have a default value")
		}
	})

	t.Run("claude sub-document contains apiKey and default model", func(t *testing.T) {
		cfg := llmProviderConfig{claudeAPIKey: "sk-ant-test"}
		doc := cfg.buildRawDocument("admin")

		claude, ok := doc["claude"].(map[string]interface{})
		if !ok {
			t.Fatal("expected claude sub-document")
		}
		if claude["apiKey"] != "sk-ant-test" {
			t.Errorf("claude.apiKey = %v, want sk-ant-test", claude["apiKey"])
		}
	})

	t.Run("deepseek sub-document present when key configured", func(t *testing.T) {
		cfg := llmProviderConfig{deepseekAPIKey: "sk-ds"}
		doc := cfg.buildRawDocument("admin")

		deepseek, ok := doc["deepseek"].(map[string]interface{})
		if !ok {
			t.Fatal("expected deepseek sub-document")
		}
		if deepseek["apiKey"] != "sk-ds" {
			t.Errorf("deepseek.apiKey = %v, want sk-ds", deepseek["apiKey"])
		}
	})

	t.Run("qwen sub-document present when key configured", func(t *testing.T) {
		cfg := llmProviderConfig{qwenAPIKey: "sk-qwen"}
		doc := cfg.buildRawDocument("admin")

		qwen, ok := doc["qwen"].(map[string]interface{})
		if !ok {
			t.Fatal("expected qwen sub-document")
		}
		if qwen["apiKey"] != "sk-qwen" {
			t.Errorf("qwen.apiKey = %v, want sk-qwen", qwen["apiKey"])
		}
	})

	t.Run("custom_llm sub-document present when url configured", func(t *testing.T) {
		cfg := llmProviderConfig{
			customLLMAPIRootURL: "http://llm.example.com/v1",
			customLLMAPIKey:     "sk-custom",
		}
		doc := cfg.buildRawDocument("admin")

		custom, ok := doc["custom_llm"].(map[string]interface{})
		if !ok {
			t.Fatal("expected custom_llm sub-document")
		}
		if custom["apiRootUrl"] != "http://llm.example.com/v1" {
			t.Errorf("custom_llm.apiRootUrl = %v, want http://llm.example.com/v1", custom["apiRootUrl"])
		}
		if custom["apiKey"] != "sk-custom" {
			t.Errorf("custom_llm.apiKey = %v, want sk-custom", custom["apiKey"])
		}
	})

	t.Run("custom_llm omits apiKey field when not configured", func(t *testing.T) {
		cfg := llmProviderConfig{customLLMAPIRootURL: "http://llm.example.com/v1"}
		doc := cfg.buildRawDocument("admin")

		custom, ok := doc["custom_llm"].(map[string]interface{})
		if !ok {
			t.Fatal("expected custom_llm sub-document")
		}
		if _, hasKey := custom["apiKey"]; hasKey {
			t.Error("custom_llm.apiKey should be absent when not configured")
		}
	})

	t.Run("absent provider key produces no sub-document", func(t *testing.T) {
		cfg := llmProviderConfig{openaiAPIKey: "sk-openai"}
		doc := cfg.buildRawDocument("admin")

		for _, provider := range []string{"claude", "deepseek", "qwen", "custom_llm"} {
			if _, exists := doc[provider]; exists {
				t.Errorf("unexpected sub-document %q when provider key not configured", provider)
			}
		}
	})

	t.Run("all providers populated when all keys configured", func(t *testing.T) {
		cfg := llmProviderConfig{
			openaiAPIKey:        "sk-openai",
			claudeAPIKey:        "sk-claude",
			deepseekAPIKey:      "sk-deepseek",
			qwenAPIKey:          "sk-qwen",
			customLLMAPIRootURL: "http://llm.example.com/v1",
			customLLMAPIKey:     "sk-custom",
		}
		doc := cfg.buildRawDocument("admin")

		for _, provider := range []string{"openai", "claude", "deepseek", "qwen", "custom_llm"} {
			if _, exists := doc[provider]; !exists {
				t.Errorf("expected sub-document %q to be present", provider)
			}
		}
	})

	t.Run("userId propagates to document field correctly", func(t *testing.T) {
		cfg := llmProviderConfig{openaiAPIKey: "sk-test"}

		for _, userID := range []string{"admin", "subscriber", "customer"} {
			doc := cfg.buildRawDocument(userID)
			assertDocField(t, doc, "userId", userID)
		}
	})

	t.Run("mcp and rpc arrays always initialized as empty", func(t *testing.T) {
		cfg := llmProviderConfig{openaiAPIKey: "sk-test"}
		doc := cfg.buildRawDocument("admin")

		mcp, mcpOK := doc["mcp"].([]interface{})
		rpc, rpcOK := doc["rpc"].([]interface{})

		if !mcpOK || len(mcp) != 0 {
			t.Error("mcp should be an empty slice")
		}
		if !rpcOK || len(rpc) != 0 {
			t.Error("rpc should be an empty slice")
		}
	})
}

func TestLLMProviderConfigFromEnv(t *testing.T) {
	t.Run("reads all SEED_ env vars", func(t *testing.T) {
		t.Setenv("SEED_OPENAI_API_KEY", "sk-openai-env")
		t.Setenv("SEED_CLAUDE_API_KEY", "sk-claude-env")
		t.Setenv("SEED_DEEPSEEK_API_KEY", "sk-ds-env")
		t.Setenv("SEED_QWEN_API_KEY", "sk-qwen-env")
		t.Setenv("SEED_CUSTOM_LLM_API_ROOT_URL", "http://custom-env.com/v1")
		t.Setenv("SEED_CUSTOM_LLM_API_KEY", "sk-custom-env")

		cfg := llmProviderConfigFromEnv()

		if cfg.openaiAPIKey != "sk-openai-env" {
			t.Errorf("openaiAPIKey = %q, want sk-openai-env", cfg.openaiAPIKey)
		}
		if cfg.claudeAPIKey != "sk-claude-env" {
			t.Errorf("claudeAPIKey = %q, want sk-claude-env", cfg.claudeAPIKey)
		}
		if cfg.deepseekAPIKey != "sk-ds-env" {
			t.Errorf("deepseekAPIKey = %q, want sk-ds-env", cfg.deepseekAPIKey)
		}
		if cfg.qwenAPIKey != "sk-qwen-env" {
			t.Errorf("qwenAPIKey = %q, want sk-qwen-env", cfg.qwenAPIKey)
		}
		if cfg.customLLMAPIRootURL != "http://custom-env.com/v1" {
			t.Errorf("customLLMAPIRootURL = %q, want http://custom-env.com/v1", cfg.customLLMAPIRootURL)
		}
		if cfg.customLLMAPIKey != "sk-custom-env" {
			t.Errorf("customLLMAPIKey = %q, want sk-custom-env", cfg.customLLMAPIKey)
		}
	})

	t.Run("returns empty config when no env vars set", func(t *testing.T) {
		cfg := llmProviderConfigFromEnv()

		if cfg.hasAnyProvider() {
			t.Error("expected empty config with no SEED_ env vars set")
		}
	})
}

func assertDocField(t *testing.T, doc map[string]interface{}, key string, want interface{}) {
	t.Helper()
	got, exists := doc[key]
	if !exists {
		t.Errorf("field %q not found in document", key)
		return
	}
	if got != want {
		t.Errorf("doc[%q] = %v, want %v", key, got, want)
	}
}

func assertDocFieldNil(t *testing.T, doc map[string]interface{}, key string) {
	t.Helper()
	got, exists := doc[key]
	if !exists {
		return
	}
	if got != nil {
		t.Errorf("doc[%q] = %v, want nil", key, got)
	}
}
