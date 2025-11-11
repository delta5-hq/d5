package claude

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) Messages(messages []Message, model string, maxTokens int) (*MessagesResponse, error) {
	return &MessagesResponse{
		ID:   "msg-mock",
		Type: "message",
		Role: "assistant",
		Content: []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}{
			{
				Type: "text",
				Text: "Mock response from E2E noop Claude service",
			},
		},
		Model:      model,
		StopReason: "end_turn",
		Usage: struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		}{
			InputTokens:  10,
			OutputTokens: 20,
		},
	}, nil
}
