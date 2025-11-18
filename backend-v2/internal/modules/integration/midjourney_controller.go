package integration

import (
	"backend-v2/internal/common/response"
	"backend-v2/internal/services/midjourney"

	"github.com/gofiber/fiber/v2"
)

/* MidjourneyController handles Midjourney AI-specific endpoints */
type MidjourneyController struct {
	service midjourney.Service
}

func NewMidjourneyController(service midjourney.Service) *MidjourneyController {
	return &MidjourneyController{
		service: service,
	}
}

func (ctrl *MidjourneyController) Create(c *fiber.Ctx) error {
	var req struct {
		Prompt      string                 `json:"prompt"`
		ProcessMode string                 `json:"process_mode"`
		Params      map[string]interface{} `json:"params"`
	}

	if err := parseBody(c, &req); err != nil {
		return err
	}

	/* Use injected service (noop or prod) */
	result, err := ctrl.service.Create(req.Prompt, req.Params)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	/* Add compatibility fields for existing E2E tests */
	response := fiber.Map{
		"task_id": result.TaskId,
		"status":  result.Status,
		"prompt":  result.Prompt,
	}
	if result.ImageURL != "" {
		response["task_result"] = fiber.Map{
			"image_url":         result.ImageURL,
			"discord_image_url": result.ImageURL,
		}
	}

	return c.JSON(response)
}

/* Upscale handles Midjourney image upscaling with polling */
func (ctrl *MidjourneyController) Upscale(c *fiber.Ctx) error {
	var req struct {
		TaskId string `json:"taskId"`
		Index  int    `json:"index"`
	}

	if err := parseBody(c, &req); err != nil {
		return err
	}

	/* Use injected service (noop or prod) */
	result, err := ctrl.service.Upscale(req.TaskId, req.Index)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	/* Add compatibility fields for existing E2E tests */
	response := fiber.Map{
		"task_id": result.TaskId,
		"status":  result.Status,
	}
	if result.ImageURL != "" {
		response["task_result"] = fiber.Map{
			"image_url":         result.ImageURL,
			"discord_image_url": result.ImageURL,
		}
	}

	return c.JSON(response)
}
