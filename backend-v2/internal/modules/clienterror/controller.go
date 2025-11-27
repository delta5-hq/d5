package clienterror

import (
	"backend-v2/internal/common/response"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

/* POST /errors - Create client error */
func (c *Controller) Create(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("userId").(string)
	if !ok {
		return response.Unauthorized(ctx, "Unauthorized")
	}

	var payload struct {
		Path      string                 `json:"path"`
		Backtrace string                 `json:"backtrace"`
		Addition  string                 `json:"addition"`
		WorkflowID string                `json:"workflowId"`
		// Any other fields go into additions
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return response.BadRequest(ctx, "Invalid payload")
	}

	// Build additions map with any extra fields
	additions := make(map[string]interface{})
	if payload.Addition != "" {
		additions["addition"] = payload.Addition
	}
	if payload.WorkflowID != "" {
		additions["workflowId"] = payload.WorkflowID
	}

	err := c.service.Create(ctx.Context(), userID, payload.Path, payload.Backtrace, additions)
	if err != nil {
		return response.InternalError(ctx, err.Error())
	}

	return ctx.JSON(fiber.Map{"success": true})
}

/* GET /errors - List errors (admin only) */
func (c *Controller) List(ctx *fiber.Ctx) error {
	auth, ok := ctx.Locals("auth").(map[string]interface{})
	if !ok {
		return response.Forbidden(ctx, "This endpoint is only available for administrators.")
	}

	roles, ok := auth["roles"].([]interface{})
	if !ok {
		return response.Forbidden(ctx, "This endpoint is only available for administrators.")
	}

	isAdmin := false
	for _, role := range roles {
		if role == "administrator" {
			isAdmin = true
			break
		}
	}

	if !isAdmin {
		return response.Forbidden(ctx, "This endpoint is only available for administrators.")
	}

	errors, err := c.service.List(ctx.Context())
	if err != nil {
		return response.InternalError(ctx, err.Error())
	}

	return ctx.JSON(errors)
}
