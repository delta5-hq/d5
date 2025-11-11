package perplexity

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type prodService struct {
	apiKey string
	client *http.Client
}

func NewProdService() Service {
	return &prodService{
		apiKey: "", // Will be set from integration config
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *prodService) ChatCompletions(messages []Message, model string, params map[string]interface{}) (*ChatCompletionResponse, error) {
	requestBody := map[string]interface{}{
		"model":    model,
		"messages": messages,
	}

	// Add optional parameters
	for key, value := range params {
		requestBody[key] = value
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.perplexity.ai/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("perplexity API returned status %d", resp.StatusCode)
	}

	var result ChatCompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
