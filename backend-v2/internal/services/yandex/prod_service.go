package yandex

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

func (s *prodService) Completion(messages []Message, model string, folderId string, params map[string]interface{}) (*CompletionResponse, error) {
	requestBody := map[string]interface{}{
		"modelUri": fmt.Sprintf("gpt://%s/%s", folderId, model),
		"completionOptions": map[string]interface{}{
			"stream":      false,
			"temperature": 0.7,
		},
		"messages": messages,
	}

	// Add optional parameters
	if opts, ok := requestBody["completionOptions"].(map[string]interface{}); ok {
		for key, value := range params {
			opts[key] = value
		}
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://llm.api.cloud.yandex.net/foundationModels/v1/completion", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Api-Key "+s.apiKey)
	req.Header.Set("x-folder-id", folderId)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yandex API returned status %d", resp.StatusCode)
	}

	var result CompletionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (s *prodService) Embeddings(texts []string, model string, folderId string) (*EmbeddingResponse, error) {
	requestBody := map[string]interface{}{
		"modelUri": fmt.Sprintf("emb://%s/%s", folderId, model),
		"text":     texts,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Api-Key "+s.apiKey)
	req.Header.Set("x-folder-id", folderId)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yandex API returned status %d", resp.StatusCode)
	}

	var result EmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
