package perplexity

import "github.com/qiniu/qmgo"

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

/* ChatCompletions returns mock Perplexity response for E2E tests */
func (s *noopService) ChatCompletions(db *qmgo.Database, userId string, messages []Message, model string, params map[string]interface{}) (*ChatCompletionResponse, error) {
	return &ChatCompletionResponse{
		ID:    "mock-perplexity-" + model,
		Model: model,
		Choices: []Choice{
			{
				Index: 0,
				Message: Message{
					Role:    "assistant",
					Content: "Mock response from E2E noop Perplexity service",
				},
				FinishReason: "stop",
			},
		},
		Usage: Usage{
			PromptTokens:     10,
			CompletionTokens: 20,
			TotalTokens:      30,
		},
	}, nil
}
