package yandex

import "github.com/qiniu/qmgo"

type Service interface {
	/* Completion sends completion request - fetches apiKey + folder_id from Integration DB by userId */
	Completion(db *qmgo.Database, userId string, messages []Message, model string, params map[string]interface{}) (*CompletionResponse, error)
	/* Embeddings generates embeddings - fetches apiKey + folder_id from Integration DB by userId */
	Embeddings(db *qmgo.Database, userId string, text string, modelUri string) (*EmbeddingResponse, error)
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
