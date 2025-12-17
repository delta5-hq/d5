package llmproxy

import (
	"time"

	"github.com/gofiber/fiber/v2"
)

/* NoopService returns mock responses for E2E testing (MOCK_EXTERNAL_SERVICES=true) */
type NoopService struct{}

func NewNoopService() Service {
	return &NoopService{}
}

func (s *NoopService) ChatCompletions(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"id":      "chatcmpl-mock",
		"object":  "chat.completion",
		"created": time.Now().Unix(),
		"model":   "gpt-4o",
		"choices": []fiber.Map{
			{
				"index": 0,
				"message": fiber.Map{
					"role":    "assistant",
					"content": "Mock response from OpenAI",
				},
				"finish_reason": "stop",
			},
		},
		"usage": fiber.Map{
			"prompt_tokens":     10,
			"completion_tokens": 5,
			"total_tokens":      15,
		},
	})
}

func (s *NoopService) Embeddings(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"object": "list",
		"data": []fiber.Map{
			{
				"object":    "embedding",
				"embedding": []float64{0.1, 0.2, 0.3},
				"index":     0,
			},
		},
		"model": "text-embedding-ada-002",
		"usage": fiber.Map{
			"prompt_tokens": 10,
			"total_tokens":  10,
		},
	})
}

func (s *NoopService) PerplexityChatCompletions(c *fiber.Ctx) error {
	return s.ChatCompletions(c) // Same structure as OpenAI
}

func (s *NoopService) ClaudeMessages(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"id":   "msg_mock",
		"type": "message",
		"role": "assistant",
		"content": []fiber.Map{
			{
				"type": "text",
				"text": "Mock response from Claude",
			},
		},
		"model":         "claude-3-sonnet",
		"stop_reason":   "end_turn",
		"stop_sequence": nil,
		"usage": fiber.Map{
			"input_tokens":  10,
			"output_tokens": 5,
		},
	})
}

func (s *NoopService) YandexCompletion(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"result": fiber.Map{
			"alternatives": []fiber.Map{
				{
					"message": fiber.Map{
						"role": "assistant",
						"text": "Mock response from Yandex",
					},
					"status": "ALTERNATIVE_STATUS_FINAL",
				},
			},
			"usage": fiber.Map{
				"inputTextTokens":  10,
				"completionTokens": 5,
				"totalTokens":      15,
			},
			"modelVersion": "yandexgpt/latest",
		},
	})
}

func (s *NoopService) DeepSeekChatCompletions(c *fiber.Ctx) error {
	return s.ChatCompletions(c)
}

func (s *NoopService) CustomLLMChatCompletions(c *fiber.Ctx) error {
	return s.ChatCompletions(c)
}

func (s *NoopService) CustomLLMEmbeddings(c *fiber.Ctx) error {
	return s.Embeddings(c)
}
