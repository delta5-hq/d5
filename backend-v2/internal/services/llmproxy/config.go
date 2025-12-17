package llmproxy

type ProviderConfig struct {
	URL            string
	AuthExtractor  AuthExtractor
	AuthHeaderName string
	ExtraHeaders   map[string]string
}

var providerConfigs = map[string]ProviderConfig{
	"openai": {
		URL:            "https://api.openai.com/v1/chat/completions",
		AuthExtractor:  BearerTokenExtractor,
		AuthHeaderName: headerAuth,
	},
	"openai-embeddings": {
		URL:            "https://api.openai.com/v1/embeddings",
		AuthExtractor:  BearerTokenExtractor,
		AuthHeaderName: headerAuth,
	},
	"perplexity": {
		URL:            "https://api.perplexity.ai/chat/completions",
		AuthExtractor:  BearerTokenExtractor,
		AuthHeaderName: headerAuth,
	},
	"claude": {
		URL:            "https://api.anthropic.com/v1/messages",
		AuthExtractor:  HeaderAPIKeyExtractor,
		AuthHeaderName: headerAPIKey,
		ExtraHeaders: map[string]string{
			"anthropic-version": "2023-06-01",
		},
	},
	"yandex": {
		URL:            "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
		AuthExtractor:  BearerTokenExtractor,
		AuthHeaderName: headerAuth,
	},
	"deepseek": {
		URL:            "https://api.deepseek.com/chat/completions",
		AuthExtractor:  BearerTokenExtractor,
		AuthHeaderName: headerAuth,
	},
}

func GetProviderConfig(provider string) (ProviderConfig, bool) {
	config, exists := providerConfigs[provider]
	return config, exists
}
