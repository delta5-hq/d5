package yandex

type Service interface {
	Completion(messages []Message, model string, folderId string, params map[string]interface{}) (*CompletionResponse, error)
	Embeddings(texts []string, model string, folderId string) (*EmbeddingResponse, error)
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"text"`
}

type CompletionResponse struct {
	Result struct {
		Alternatives []struct {
			Message struct {
				Role string `json:"role"`
				Text string `json:"text"`
			} `json:"message"`
			Status string `json:"status"`
		} `json:"alternatives"`
		Usage struct {
			InputTokens  int `json:"inputTextTokens"`
			OutputTokens int `json:"completionTokens"`
			TotalTokens  int `json:"totalTokens"`
		} `json:"usage"`
		ModelVersion string `json:"modelVersion"`
	} `json:"result"`
}

type EmbeddingResponse struct {
	Embeddings   [][]float64 `json:"embedding"`
	ModelVersion string      `json:"modelVersion"`
}
