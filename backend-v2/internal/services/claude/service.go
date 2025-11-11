package claude

import "github.com/qiniu/qmgo"

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type MessagesResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Model        string `json:"model"`
	StopReason   string `json:"stop_reason"`
	StopSequence string `json:"stop_sequence,omitempty"`
	Usage        struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

type Service interface {
	/* Messages sends messages to Claude API - fetches API key from Integration DB by userId */
	Messages(db *qmgo.Database, userId string, messages []Message, model string, maxTokens int) (*MessagesResponse, error)
}
