package integration

import (
	"backend-v2/internal/services/perplexity"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

/* PerplexityController handles Perplexity AI-specific endpoints */
type PerplexityController struct {
	service perplexity.Service
	db      *qmgo.Database
}

func NewPerplexityController(service perplexity.Service, db *qmgo.Database) *PerplexityController {
	return &PerplexityController{service: service, db: db}
}

/* PerplexityChatCompletionsRequest holds Perplexity chat completions API request data */
type PerplexityChatCompletionsRequest struct {
	Messages []perplexity.Message `json:"messages"`
	Model    string               `json:"model"`
}

func (r *PerplexityChatCompletionsRequest) Validate() error {
	if len(r.Messages) == 0 {
		return fmt.Errorf("Messages are required")
	}
	return nil
}

/* ChatCompletions handles Perplexity chat completions API */
func (ctrl *PerplexityController) ChatCompletions(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	var req PerplexityChatCompletionsRequest
	if err := parseBody(c, &req); err != nil {
		return err
	}

	if err := req.Validate(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	result, err := ctrl.service.ChatCompletions(ctrl.db, userID, req.Messages, req.Model, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(result)
}
