package claude

import (
	"backend-v2/internal/models"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

type prodService struct {
	client *http.Client
}

func NewProdService() Service {
	return &prodService{
		client: &http.Client{},
	}
}

/* Messages sends messages to Claude API - fetches API key from Integration DB by userId */
func (s *prodService) Messages(db *qmgo.Database, userId string, messages []Message, model string, maxTokens int) (*MessagesResponse, error) {
	var integration models.Integration
	err := db.Collection("integrations").Find(context.Background(), bson.M{"userId": userId}).One(&integration)
	if err != nil {
		return nil, fmt.Errorf("integration not found for user: %w", err)
	}

	if integration.Claude == nil || integration.Claude.APIKey == "" {
		return nil, errors.New("claude API key not configured")
	}

	apiKey := integration.Claude.APIKey

	if model == "" && integration.Claude.Model != "" {
		model = integration.Claude.Model
	}
	
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
	req.Header.Set("x-api-key", apiKey)
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
