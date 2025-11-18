package integration

import (
	"backend-v2/internal/common/response"
	"backend-v2/internal/services/openai"
	"strings"

	"github.com/gofiber/fiber/v2"
)

/* OpenAIController handles OpenAI-specific endpoints */
type OpenAIController struct {
	service openai.Service
}

func NewOpenAIController(service openai.Service) *OpenAIController {
	return &OpenAIController{service: service}
}

func (ctrl *OpenAIController) CheckApiKey(c *fiber.Ctx) error {
	success := ctrl.service.CheckApiKey()
	return c.JSON(fiber.Map{"success": success})
}

func (ctrl *OpenAIController) ChatCompletions(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	var userApiKey string
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 {
			userApiKey = parts[1]
		}
	}

	var req struct {
		Messages []openai.ChatMessage   `json:"messages"`
		Model    string                 `json:"model"`
		Params   map[string]interface{} `json:"-"`
	}

	if err := parseBody(c, &req); err != nil {
		return err
	}

	if req.Model == "" {
		return response.InternalError(c, "Model name not specified")
	}

	if len(req.Messages) == 0 || req.Messages[0].Content == "" {
		return response.InternalError(c, "Message not specified")
	}

	resp, err := ctrl.service.ChatCompletions(userApiKey, req.Messages, req.Model, req.Params)
	if err != nil {
		if err.Error() == "OpenAI api key not found" {
			return response.Unauthorized(c, err.Error())
		}
		return response.InternalError(c, err.Error())
	}

	return c.JSON(resp)
}

func (ctrl *OpenAIController) Embeddings(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	var userApiKey string
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 {
			userApiKey = parts[1]
		}
	}

	var req struct {
		Input interface{} `json:"input"`
		Model string      `json:"model"`
	}

	if err := parseBody(c, &req); err != nil {
		return err
	}

	/* Validate input - accept string or array */
	var inputArray []string
	switch v := req.Input.(type) {
	case string:
		if v == "" {
			return response.InternalError(c, "Input not specified")
		}
		inputArray = []string{v}
	case []interface{}:
		if len(v) == 0 {
			return response.InternalError(c, "Input not specified")
		}
		for _, item := range v {
			if str, ok := item.(string); ok {
				inputArray = append(inputArray, str)
			}
		}
	default:
		return response.InternalError(c, "Input not specified")
	}

	if req.Model == "" {
		return response.InternalError(c, "Model name not specified")
	}

	resp, err := ctrl.service.Embeddings(userApiKey, inputArray, req.Model)
	if err != nil {
		if err.Error() == "OpenAI api key not found" {
			return response.Unauthorized(c, err.Error())
		}
		return response.InternalError(c, err.Error())
	}

	return c.JSON(resp)
}

func (ctrl *OpenAIController) ImageGenerations(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	var userApiKey string
	if authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 {
			userApiKey = parts[1]
		}
	}

	var req struct {
		Prompt         string `json:"prompt"`
		N              int    `json:"n"`
		Size           string `json:"size"`
		ResponseFormat string `json:"response_format"`
	}

	if err := parseBody(c, &req); err != nil {
		return err
	}

	if req.Prompt == "" {
		return response.BadRequest(c, "Input not specified")
	}

	resp, err := ctrl.service.DalleGenerations(userApiKey, req.Prompt, req.N, req.Size, req.ResponseFormat)
	if err != nil {
		if err.Error() == "OpenAI api key not found" {
			return response.Unauthorized(c, err.Error())
		}
		return response.InternalError(c, err.Error())
	}

	return c.JSON(resp)
}
