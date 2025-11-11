package perplexity

import (
	"backend-v2/internal/models"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

type prodService struct {
	client *http.Client
}

func NewProdService() Service {
	return &prodService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

/* ChatCompletions sends chat completion request - fetches API key from Integration DB by userId */
func (s *prodService) ChatCompletions(db *qmgo.Database, userId string, messages []Message, model string, params map[string]interface{}) (*ChatCompletionResponse, error) {
	var integration models.Integration
	err := db.Collection("integrations").Find(context.Background(), bson.M{"userId": userId}).One(&integration)
	if err != nil {
		return nil, fmt.Errorf("integration not found for user: %w", err)
	}

	if integration.Perplexity == nil || integration.Perplexity.APIKey == "" {
		return nil, errors.New("perplexity API key not configured")
	}

	apiKey := integration.Perplexity.APIKey

	if model == "" && integration.Perplexity.Model != "" {
		model = integration.Perplexity.Model
	}

	requestBody := map[string]interface{}{
		"model":    model,
		"messages": messages,
	}

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
	req.Header.Set("Authorization", "Bearer "+apiKey)

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
