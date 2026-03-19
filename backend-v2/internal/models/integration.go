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

type MCPIntegrationConfig struct {
	Alias          string                 `json:"alias" bson:"alias"`
	ServerURL      string                 `json:"serverUrl,omitempty" bson:"serverUrl,omitempty"`
	Transport      string                 `json:"transport" bson:"transport"`
	ToolName       string                 `json:"toolName" bson:"toolName"`
	ToolInputField string                 `json:"toolInputField,omitempty" bson:"toolInputField,omitempty"`
	ToolStaticArgs map[string]interface{} `json:"toolStaticArgs,omitempty" bson:"toolStaticArgs,omitempty"`
	Headers        map[string]string      `json:"headers,omitempty" bson:"headers,omitempty"`
	Description    string                 `json:"description,omitempty" bson:"description,omitempty"`
	TimeoutMs      *int                   `json:"timeoutMs,omitempty" bson:"timeoutMs,omitempty"`
	Command        string                 `json:"command,omitempty" bson:"command,omitempty"`
	Args           []string               `json:"args,omitempty" bson:"args,omitempty"`
	Env            map[string]string      `json:"env,omitempty" bson:"env,omitempty"`
}

type RPCIntegrationConfig struct {
	Alias           string            `json:"alias" bson:"alias"`
	Protocol        string            `json:"protocol" bson:"protocol"`
	Description     string            `json:"description,omitempty" bson:"description,omitempty"`
	TimeoutMs       *int              `json:"timeoutMs,omitempty" bson:"timeoutMs,omitempty"`
	Host            string            `json:"host,omitempty" bson:"host,omitempty"`
	Port            *int              `json:"port,omitempty" bson:"port,omitempty"`
	Username        string            `json:"username,omitempty" bson:"username,omitempty"`
	PrivateKey      string            `json:"privateKey,omitempty" bson:"privateKey,omitempty"`
	Passphrase      string            `json:"passphrase,omitempty" bson:"passphrase,omitempty"`
	CommandTemplate string            `json:"commandTemplate,omitempty" bson:"commandTemplate,omitempty"`
	WorkingDir      string            `json:"workingDir,omitempty" bson:"workingDir,omitempty"`
	URL             string            `json:"url,omitempty" bson:"url,omitempty"`
	Method          string            `json:"method,omitempty" bson:"method,omitempty"`
	Headers         map[string]string `json:"headers,omitempty" bson:"headers,omitempty"`
	BodyTemplate    string            `json:"bodyTemplate,omitempty" bson:"bodyTemplate,omitempty"`
	OutputFormat    string            `json:"outputFormat,omitempty" bson:"outputFormat,omitempty"`
	OutputField     string            `json:"outputField,omitempty" bson:"outputField,omitempty"`
	SessionIdField  string            `json:"sessionIdField,omitempty" bson:"sessionIdField,omitempty"`
	Command         string            `json:"command,omitempty" bson:"command,omitempty"`
	Args            []string          `json:"args,omitempty" bson:"args,omitempty"`
	Env             map[string]string `json:"env,omitempty" bson:"env,omitempty"`
	AutoApprove     string            `json:"autoApprove,omitempty" bson:"autoApprove,omitempty"`
	AllowedTools    []string          `json:"allowedTools,omitempty" bson:"allowedTools,omitempty"`
}

type Integration struct {
	ID         string                 `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID     string                 `json:"userId" bson:"userId"`
	WorkflowID *string                `json:"workflowId,omitempty" bson:"workflowId,omitempty"`
	OpenAI     *OpenAIConfig          `json:"openai,omitempty" bson:"openai,omitempty"`
	Yandex     *YandexConfig          `json:"yandex,omitempty" bson:"yandex,omitempty"`
	Claude     *ClaudeConfig          `json:"claude,omitempty" bson:"claude,omitempty"`
	Qwen       *QwenConfig            `json:"qwen,omitempty" bson:"qwen,omitempty"`
	Deepseek   *DeepseekConfig        `json:"deepseek,omitempty" bson:"deepseek,omitempty"`
	CustomLLM  *CustomLLMConfig       `json:"custom_llm,omitempty" bson:"custom_llm,omitempty"`
	Perplexity *PerplexityConfig      `json:"perplexity,omitempty" bson:"perplexity,omitempty"`
	Lang       string                 `json:"lang" bson:"lang"`
	Model      string                 `json:"model" bson:"model"`
	MCP        []MCPIntegrationConfig `json:"mcp,omitempty" bson:"mcp,omitempty"`
	RPC        []RPCIntegrationConfig `json:"rpc,omitempty" bson:"rpc,omitempty"`
}
