package llmproxy

import (
	"github.com/gofiber/fiber/v2"
)

/* Service defines LLM proxy operations for API key validation */
type Service interface {
	/* OpenAI endpoints */
	ChatCompletions(c *fiber.Ctx) error
	Embeddings(c *fiber.Ctx) error

	/* Perplexity endpoints */
	PerplexityChatCompletions(c *fiber.Ctx) error

	/* Claude endpoints */
	ClaudeMessages(c *fiber.Ctx) error

	/* Yandex endpoints */
	YandexCompletion(c *fiber.Ctx) error

	/* DeepSeek endpoints */
	DeepSeekChatCompletions(c *fiber.Ctx) error

	/* Custom LLM endpoints */
	CustomLLMChatCompletions(c *fiber.Ctx) error
	CustomLLMEmbeddings(c *fiber.Ctx) error
}
