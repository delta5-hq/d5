package freepik

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
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

func (s *prodService) SearchIcons(query string, limit int) (*IconSearchResponse, error) {
	params := url.Values{}
	params.Set("term", query)
	params.Set("limit", fmt.Sprintf("%d", limit))

	req, err := http.NewRequest("GET", "https://api.freepik.com/v1/icons?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Freepik-API-Key", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("freepik API returned status %d", resp.StatusCode)
	}

	var result IconSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

func (s *prodService) DownloadIcon(iconId string) (*DownloadResponse, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("https://api.freepik.com/v1/icons/%s/download", iconId), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Freepik-API-Key", s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("freepik API returned status %d", resp.StatusCode)
	}

	var result DownloadResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
