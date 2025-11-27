package apikey

import (
	"backend-v2/internal/models"
	"backend-v2/internal/repositories/integration"
	"context"
	"errors"
	"fmt"
)

/* Provider abstracts API key retrieval for external services */
type Provider interface {
	GetYandexConfig(ctx context.Context, userID string) (*models.YandexConfig, error)
	GetClaudeConfig(ctx context.Context, userID string) (*models.ClaudeConfig, error)
	GetPerplexityConfig(ctx context.Context, userID string) (*models.PerplexityConfig, error)
}

/* IntegrationProvider retrieves API keys from Integration repository */
type IntegrationProvider struct {
	repo integration.Repository
}

func NewIntegrationProvider(repo integration.Repository) Provider {
	return &IntegrationProvider{repo: repo}
}

/* GetYandexConfig retrieves Yandex API configuration for user */
func (p *IntegrationProvider) GetYandexConfig(ctx context.Context, userID string) (*models.YandexConfig, error) {
	integration, err := p.repo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("integration not found for user: %w", err)
	}

	if integration.Yandex == nil || integration.Yandex.APIKey == "" {
		return nil, errors.New("yandex API key not configured")
	}

	return integration.Yandex, nil
}

/* GetClaudeConfig retrieves Claude API configuration for user */
func (p *IntegrationProvider) GetClaudeConfig(ctx context.Context, userID string) (*models.ClaudeConfig, error) {
	integration, err := p.repo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("integration not found for user: %w", err)
	}

	if integration.Claude == nil || integration.Claude.APIKey == "" {
		return nil, errors.New("claude API key not configured")
	}

	return integration.Claude, nil
}

/* GetPerplexityConfig retrieves Perplexity API configuration for user */
func (p *IntegrationProvider) GetPerplexityConfig(ctx context.Context, userID string) (*models.PerplexityConfig, error) {
	integration, err := p.repo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("integration not found for user: %w", err)
	}

	if integration.Perplexity == nil || integration.Perplexity.APIKey == "" {
		return nil, errors.New("perplexity API key not configured")
	}

	return integration.Perplexity, nil
}
