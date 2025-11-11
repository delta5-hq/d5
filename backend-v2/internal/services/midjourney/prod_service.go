package midjourney

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type prodService struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

func NewProdService() Service {
	return &prodService{
		apiKey:  "", // Will be set from integration config
		baseURL: "https://api.midjourney.com/v1", // Example base URL
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (s *prodService) Create(prompt string, params map[string]interface{}) (*CreateResponse, error) {
	requestBody := map[string]interface{}{
		"prompt": prompt,
	}

	// Add optional parameters
	for key, value := range params {
		requestBody[key] = value
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.baseURL+"/imagine", bytes.NewBuffer(jsonData))
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

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("midjourney API returned status %d", resp.StatusCode)
	}

	var result CreateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (s *prodService) Upscale(taskId string, index int) (*UpscaleResponse, error) {
	requestBody := map[string]interface{}{
		"task_id": taskId,
		"index":   index,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", s.baseURL+"/upscale", bytes.NewBuffer(jsonData))
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

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("midjourney API returned status %d", resp.StatusCode)
	}

	var result UpscaleResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
