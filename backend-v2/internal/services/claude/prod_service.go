package claude

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type prodService struct {
	apiKey string
	client *http.Client
}

func NewProdService() Service {
	apiKey := os.Getenv("CLAUDE_API_KEY")
	if apiKey == "" {
		return &noopService{}
	}

	return &prodService{
		apiKey: apiKey,
		client: &http.Client{},
	}
}

func (s *prodService) Messages(messages []Message, model string, maxTokens int) (*MessagesResponse, error) {
	if model == "" {
		model = "claude-3-sonnet-20240229"
	}
	if maxTokens == 0 {
		maxTokens = 1024
	}

	reqBody := map[string]interface{}{
		"model":      model,
		"max_tokens": maxTokens,
		"messages":   messages,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Claude API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Claude API error %d: %s", resp.StatusCode, string(body))
	}

	var result MessagesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
