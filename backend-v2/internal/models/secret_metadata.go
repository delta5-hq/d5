package models

type LLMSecretMetadata struct {
	APIKey bool `json:"apiKey,omitempty"`
}

type ArrayItemSecretMetadata struct {
	PrivateKey bool `json:"privateKey,omitempty"`
	Passphrase bool `json:"passphrase,omitempty"`
	Headers    bool `json:"headers,omitempty"`
	Env        bool `json:"env,omitempty"`
}

type SecretMetadata struct {
	OpenAI     *LLMSecretMetadata                  `json:"openai,omitempty"`
	Yandex     *LLMSecretMetadata                  `json:"yandex,omitempty"`
	Claude     *LLMSecretMetadata                  `json:"claude,omitempty"`
	Qwen       *LLMSecretMetadata                  `json:"qwen,omitempty"`
	Deepseek   *LLMSecretMetadata                  `json:"deepseek,omitempty"`
	CustomLLM  *LLMSecretMetadata                  `json:"custom_llm,omitempty"`
	Perplexity *LLMSecretMetadata                  `json:"perplexity,omitempty"`
	MCP        map[string]*ArrayItemSecretMetadata `json:"mcp,omitempty"`
	RPC        map[string]*ArrayItemSecretMetadata `json:"rpc,omitempty"`
}

type IntegrationWithMetadata struct {
	*Integration
	SecretsMeta *SecretMetadata `json:"secretsMeta,omitempty"`
}
