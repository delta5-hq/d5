package claude

import "github.com/qiniu/qmgo"

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

/* Messages returns mock Claude response for E2E tests */
func (s *noopService) Messages(db *qmgo.Database, userId string, messages []Message, model string, maxTokens int) (*MessagesResponse, error) {
	return &MessagesResponse{
		ID:   "mock-claude-response-id",
		Type: "message",
		Role: "assistant",
		Content: []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}{
			{
				Type: "text",
				Text: "This is a mock response from Claude for E2E testing.",
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

