package yandex

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) Completion(messages []Message, model string, folderId string, params map[string]interface{}) (*CompletionResponse, error) {
	response := &CompletionResponse{}
	response.Result.Alternatives = []struct {
		Message struct {
			Role string `json:"role"`
			Text string `json:"text"`
		} `json:"message"`
		Status string `json:"status"`
	}{
		{
			Message: struct {
				Role string `json:"role"`
				Text string `json:"text"`
			}{
				Role: "assistant",
				Text: "Mock response from E2E noop Yandex service",
			},
			Status: "ALTERNATIVE_STATUS_FINAL",
		},
	}
	response.Result.Usage.InputTokens = 10
	response.Result.Usage.OutputTokens = 20
	response.Result.Usage.TotalTokens = 30
	response.Result.ModelVersion = model

	return response, nil
}

func (s *noopService) Embeddings(texts []string, model string, folderId string) (*EmbeddingResponse, error) {
	embeddings := make([][]float64, len(texts))
	for i := range texts {
		embeddings[i] = make([]float64, 256) // Yandex typically uses 256-dim vectors
	}

	return &EmbeddingResponse{
		Embeddings:   embeddings,
		ModelVersion: model,
	}, nil
}
