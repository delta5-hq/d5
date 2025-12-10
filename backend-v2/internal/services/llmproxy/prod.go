package llmproxy

import (
	"backend-v2/internal/common/http"
	"backend-v2/internal/common/response"
	"time"

	"github.com/gofiber/fiber/v2"
)

type ProdService struct {
	httpClient http.Client
}

func NewProdService() Service {
	factory := http.NewClientFactory()
	return &ProdService{
		httpClient: factory.Create(30 * time.Second),
	}
}

func (s *ProdService) ChatCompletions(c *fiber.Ctx) error {
	return s.proxyWithConfig(c, "openai")
}

func (s *ProdService) Embeddings(c *fiber.Ctx) error {
	return s.proxyWithConfig(c, "openai-embeddings")
}

func (s *ProdService) PerplexityChatCompletions(c *fiber.Ctx) error {
	return s.proxyWithConfig(c, "perplexity")
}

func (s *ProdService) ClaudeMessages(c *fiber.Ctx) error {
	return s.proxyWithConfig(c, "claude")
}

func (s *ProdService) YandexCompletion(c *fiber.Ctx) error {
	return s.proxyWithConfig(c, "yandex")
}

func (s *ProdService) CustomLLMChatCompletions(c *fiber.Ctx) error {
	return s.proxyCustomLLM(c, "/chat/completions")
}

func (s *ProdService) CustomLLMEmbeddings(c *fiber.Ctx) error {
	return s.proxyCustomLLM(c, "/embeddings")
}

func (s *ProdService) proxyCustomLLM(c *fiber.Ctx, endpoint string) error {
	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	url, ok := body["url"].(string)
	if !ok || url == "" {
		return response.BadRequest(c, "URL parameter is required")
	}
	delete(body, "url")

	apiKey := BearerTokenExtractor(c)

	req, err := BuildProxyRequest(ProxyRequest{
		TargetURL:  url + endpoint,
		APIKey:     apiKey,
		Body:       body,
		AuthHeader: headerAuth,
	})
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	respBody, statusCode, err := ExecuteProxyRequest(s.httpClient, req)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return SendProxyResponse(c, respBody, statusCode)
}

func (s *ProdService) proxyWithConfig(c *fiber.Ctx, provider string) error {
	config, exists := GetProviderConfig(provider)
	if !exists {
		return response.InternalError(c, "Unknown provider")
	}

	apiKey := config.AuthExtractor(c)
	if IsEmptyAPIKey(apiKey) {
		return response.Unauthorized(c, "API key required")
	}

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	req, err := BuildProxyRequest(ProxyRequest{
		TargetURL:    config.URL,
		APIKey:       apiKey,
		Body:         body,
		AuthHeader:   config.AuthHeaderName,
		ExtraHeaders: config.ExtraHeaders,
	})
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	respBody, statusCode, err := ExecuteProxyRequest(s.httpClient, req)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return SendProxyResponse(c, respBody, statusCode)
}
