package yandex

import "github.com/qiniu/qmgo"

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

/* Completion returns mock Yandex completion response for E2E tests */
func (s *noopService) Completion(db *qmgo.Database, userId string, messages []Message, model string, params map[string]interface{}) (*CompletionResponse, error) {
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

/* Embeddings returns mock Yandex embeddings for E2E tests */
func (s *noopService) Embeddings(db *qmgo.Database, userId string, text string, modelUri string) (*EmbeddingResponse, error) {
	embedding := make([]float64, 256) // Yandex typically uses 256-dim vectors

	return &EmbeddingResponse{
		Embeddings:   [][]float64{embedding},
		ModelVersion: modelUri,
	}, nil
}
