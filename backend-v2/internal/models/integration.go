package models

type OpenAIConfig struct {
	APIKey string `json:"apiKey" bson:"apiKey"`
	Model  string `json:"model,omitempty" bson:"model,omitempty"`
	User   string `json:"user,omitempty" bson:"user,omitempty"`
	Suffix string `json:"suffix,omitempty" bson:"suffix,omitempty"`
}

type YandexConfig struct {
	APIKey   string `json:"apiKey" bson:"apiKey"`
	FolderID string `json:"folder_id,omitempty" bson:"folder_id,omitempty"`
	Model    string `json:"model,omitempty" bson:"model,omitempty"`
}

type ClaudeConfig struct {
	APIKey string `json:"apiKey" bson:"apiKey"`
	Model  string `json:"model,omitempty" bson:"model,omitempty"`
}

type PerplexityConfig struct {
	APIKey string `json:"apiKey" bson:"apiKey"`
	Model  string `json:"model,omitempty" bson:"model,omitempty"`
}

type QwenConfig struct {
	APIKey string `json:"apiKey" bson:"apiKey"`
	Model  string `json:"model,omitempty" bson:"model,omitempty"`
}

type DeepseekConfig struct {
	APIKey string `json:"apiKey" bson:"apiKey"`
	Model  string `json:"model,omitempty" bson:"model,omitempty"`
}

type CustomLLMConfig struct {
	APIRootURL          string `json:"apiRootUrl,omitempty" bson:"apiRootUrl,omitempty"`
	MaxTokens           int    `json:"maxTokens,omitempty" bson:"maxTokens,omitempty"`
	EmbeddingsChunkSize int    `json:"embeddingsChunkSize,omitempty" bson:"embeddingsChunkSize,omitempty"`
	APIType             string `json:"apiType,omitempty" bson:"apiType,omitempty"`
	APIKey              string `json:"apiKey,omitempty" bson:"apiKey,omitempty"`
}

type Integration struct {
	ID         string            `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID     string            `json:"userId" bson:"userId"`
	OpenAI     *OpenAIConfig     `json:"openai,omitempty" bson:"openai,omitempty"`
	Yandex     *YandexConfig     `json:"yandex,omitempty" bson:"yandex,omitempty"`
	Claude     *ClaudeConfig     `json:"claude,omitempty" bson:"claude,omitempty"`
	Qwen       *QwenConfig       `json:"qwen,omitempty" bson:"qwen,omitempty"`
	Deepseek   *DeepseekConfig   `json:"deepseek,omitempty" bson:"deepseek,omitempty"`
	CustomLLM  *CustomLLMConfig  `json:"custom_llm,omitempty" bson:"custom_llm,omitempty"`
	Perplexity *PerplexityConfig `json:"perplexity,omitempty" bson:"perplexity,omitempty"`
	Lang       string            `json:"lang" bson:"lang"`
	Model      string            `json:"model" bson:"model"`
}
