package openai

import "time"

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) ChatCompletions(messages []ChatMessage, model string, params map[string]interface{}) (*ChatCompletionResponse, error) {
	return &ChatCompletionResponse{
		ID:      "chatcmpl-mock",
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []struct {
			Index   int         `json:"index"`
			Message ChatMessage `json:"message"`
		}{
			{
				Index: 0,
				Message: ChatMessage{
					Role:    "assistant",
					Content: "Mock response from E2E noop service",
				},
			},
		},
	}, nil
}

func (s *noopService) Embeddings(input []string, model string) (*EmbeddingResponse, error) {
	data := make([]struct {
		Index     int       `json:"index"`
		Object    string    `json:"object"`
		Embedding []float64 `json:"embedding"`
	}, len(input))

	for i := range input {
		data[i] = struct {
			Index     int       `json:"index"`
			Object    string    `json:"object"`
			Embedding []float64 `json:"embedding"`
		}{
			Index:     i,
			Object:    "embedding",
			Embedding: make([]float64, 1536),
		}
	}

	return &EmbeddingResponse{Data: data}, nil
}

func (s *noopService) DalleGenerations(prompt string, n int, size string, responseFormat string) (*ImageGenerationResponse, error) {
	data := make([]struct {
		URL string `json:"url"`
	}, n)

	for i := 0; i < n; i++ {
		data[i] = struct {
			URL string `json:"url"`
		}{
			URL: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		}
	}

	return &ImageGenerationResponse{
		Created: time.Now().Unix(),
		Data:    data,
	}, nil
}

func (s *noopService) CheckApiKey() bool {
	return true
}
