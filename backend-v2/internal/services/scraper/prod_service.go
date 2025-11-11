package scraper

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// prodService is the production implementation for web scraping
type prodService struct {
	client *http.Client
	apiKey string
}

// NewProdService creates a new production scraper service
func NewProdService() Service {
	return &prodService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		apiKey: "", // API key for scraping service if needed
	}
}

// ScrapeV2 scrapes a URL and returns the content using a scraping service
func (s *prodService) ScrapeV2(url string) (*ScrapeV2Response, error) {
	if url == "" {
		return nil, errors.New("url is required")
	}

	// Simple HTTP GET request - in production, this would use a proper scraping service
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; D5Scraper/1.0)")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return &ScrapeV2Response{
		Content: string(body),
		Title:   "Scraped Page",
		URL:     url,
	}, nil
}

// ScrapeFiles scrapes a URL and returns a list of files found
func (s *prodService) ScrapeFiles(url string) ([]ScrapeFilesResponse, error) {
	if url == "" {
		return nil, errors.New("url is required")
	}

	// In production, this would parse HTML and extract file links
	// For now, return basic implementation
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; D5Scraper/1.0)")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	// In production, would parse HTML for file links
	// For now, return empty list
	return []ScrapeFilesResponse{}, nil
}

// Helper function to parse scraping API response (if using external service)
func parseScrapingResponse(body []byte) (*ScrapeV2Response, error) {
	var result struct {
		Content string `json:"content"`
		Title   string `json:"title"`
		URL     string `json:"url"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &ScrapeV2Response{
		Content: result.Content,
		Title:   result.Title,
		URL:     result.URL,
	}, nil
}
