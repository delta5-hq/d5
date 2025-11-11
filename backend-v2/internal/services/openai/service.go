package openai

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int         `json:"index"`
		Message ChatMessage `json:"message"`
	} `json:"choices"`
}

type EmbeddingResponse struct {
	Data []struct {
		Index     int       `json:"index"`
		Object    string    `json:"object"`
		Embedding []float64 `json:"embedding"`
	} `json:"data"`
}

type ImageGenerationResponse struct {
	Created int64 `json:"created"`
	Data    []struct {
		URL string `json:"url"`
	} `json:"data"`
}

type Service interface {
	ChatCompletions(apiKey string, messages []ChatMessage, model string, params map[string]interface{}) (*ChatCompletionResponse, error)
	Embeddings(apiKey string, input []string, model string) (*EmbeddingResponse, error)
	DalleGenerations(apiKey string, prompt string, n int, size string, responseFormat string) (*ImageGenerationResponse, error)
	CheckApiKey() bool
}
