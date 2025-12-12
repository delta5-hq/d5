package llmproxy

import (
	"testing"
)

func TestGetProviderConfig_OpenAI(t *testing.T) {
	config, exists := GetProviderConfig("openai")

	if !exists {
		t.Fatal("openai provider should exist")
	}

	if config.URL != "https://api.openai.com/v1/chat/completions" {
		t.Errorf("URL = %v, want https://api.openai.com/v1/chat/completions", config.URL)
	}

	if config.AuthHeaderName != headerAuth {
		t.Errorf("AuthHeaderName = %v, want %v", config.AuthHeaderName, headerAuth)
	}

	if config.AuthExtractor == nil {
		t.Error("AuthExtractor should not be nil")
	}
}

func TestGetProviderConfig_OpenAIEmbeddings(t *testing.T) {
	config, exists := GetProviderConfig("openai-embeddings")

	if !exists {
		t.Fatal("openai-embeddings provider should exist")
	}

	if config.URL != "https://api.openai.com/v1/embeddings" {
		t.Errorf("URL = %v, want https://api.openai.com/v1/embeddings", config.URL)
	}

	if config.AuthHeaderName != headerAuth {
		t.Errorf("AuthHeaderName = %v, want %v", config.AuthHeaderName, headerAuth)
	}
}

func TestGetProviderConfig_Perplexity(t *testing.T) {
	config, exists := GetProviderConfig("perplexity")

	if !exists {
		t.Fatal("perplexity provider should exist")
	}

	if config.URL != "https://api.perplexity.ai/chat/completions" {
		t.Errorf("URL = %v, want https://api.perplexity.ai/chat/completions", config.URL)
	}

	if config.AuthHeaderName != headerAuth {
		t.Errorf("AuthHeaderName = %v, want %v", config.AuthHeaderName, headerAuth)
	}
}

func TestGetProviderConfig_Claude(t *testing.T) {
	config, exists := GetProviderConfig("claude")

	if !exists {
		t.Fatal("claude provider should exist")
	}

	if config.URL != "https://api.anthropic.com/v1/messages" {
		t.Errorf("URL = %v, want https://api.anthropic.com/v1/messages", config.URL)
	}

	if config.AuthHeaderName != headerAPIKey {
		t.Errorf("AuthHeaderName = %v, want %v", config.AuthHeaderName, headerAPIKey)
	}

	if config.ExtraHeaders["anthropic-version"] != "2023-06-01" {
		t.Errorf("anthropic-version = %v, want 2023-06-01", config.ExtraHeaders["anthropic-version"])
	}
}

func TestGetProviderConfig_Yandex(t *testing.T) {
	config, exists := GetProviderConfig("yandex")

	if !exists {
		t.Fatal("yandex provider should exist")
	}

	if config.URL != "https://llm.api.cloud.yandex.net/foundationModels/v1/completion" {
		t.Errorf("URL = %v, want https://llm.api.cloud.yandex.net/foundationModels/v1/completion", config.URL)
	}

	if config.AuthHeaderName != headerAuth {
		t.Errorf("AuthHeaderName = %v, want %v", config.AuthHeaderName, headerAuth)
	}
}

func TestGetProviderConfig_Unknown(t *testing.T) {
	_, exists := GetProviderConfig("unknown-provider")

	if exists {
		t.Error("unknown-provider should not exist")
	}
}

func TestGetProviderConfig_AllProvidersHaveAuthExtractor(t *testing.T) {
	providers := []string{"openai", "openai-embeddings", "perplexity", "claude", "yandex"}

	for _, provider := range providers {
		config, exists := GetProviderConfig(provider)
		if !exists {
			t.Errorf("Provider %v should exist", provider)
			continue
		}

		if config.AuthExtractor == nil {
			t.Errorf("Provider %v missing AuthExtractor", provider)
		}
	}
}
