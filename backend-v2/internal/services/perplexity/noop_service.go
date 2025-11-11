package perplexity

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) ChatCompletions(messages []Message, model string, params map[string]interface{}) (*ChatCompletionResponse, error) {
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
