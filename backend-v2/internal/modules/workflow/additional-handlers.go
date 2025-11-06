package workflow

import (
	"backend-v2/internal/models"

	"github.com/gofiber/fiber/v2"
)

func (h *WorkflowController) GetWriteable(c *fiber.Ctx) error {
	access := c.Locals("access").(WorkflowAccess)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"writeable": access.IsWriteable,
	})
}

func (h *WorkflowController) GetNodeLimit(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)
	auth, err := GetJwtPayload(c)

	var nodeLimit interface{} = false

	if err == nil && workflow.UserID == auth.Sub {
		if limitNodes, ok := auth.Claims["limitNodes"].(float64); ok && limitNodes > 0 {
			nodeLimit = int(limitNodes)
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"limit": nodeLimit,
	})
}

func (h *WorkflowController) AddCategory(c *fiber.Ctx) error {
	access := c.Locals("access").(WorkflowAccess)

	if !access.IsOwner {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "You are not the owner of this workflow.",
		})
	}

	var body struct {
		Category *string `json:"category"`
	}

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	workflow := c.Locals("workflow").(*models.Workflow)
	workflow.Category = body.Category

	updateErr := h.Service.UpdateWorkflow(c.Context(), workflow.WorkflowID, workflow)
	if updateErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": updateErr.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

func (h *WorkflowController) UpdateShare(c *fiber.Ctx) error {
	access := c.Locals("access").(WorkflowAccess)

	if !access.IsOwner {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "You are not the owner of this workflow.",
		})
	}

	var body struct {
		Enabled bool   `json:"enabled"`
		Users   []string `json:"users"`
	}

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

func (h *WorkflowController) ExportJSON(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)

	c.Set("Content-Type", "application/json")
	c.Set("Content-Disposition", "attachment; filename="+workflow.WorkflowID+".json")

	return c.Status(fiber.StatusOK).JSON(workflow)
}

func (h *WorkflowController) ExportZIP(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"error": "ZIP export not yet implemented",
	})
}

func GetJwtPayload(c *fiber.Ctx) (*JwtPayload, error) {
	auth := c.Locals("auth")
	if auth == nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "No auth token")
	}

	claims, ok := auth.(map[string]interface{})
	if !ok {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "Invalid token claims")
	}

	sub, _ := claims["sub"].(string)

	return &JwtPayload{
		Sub:    sub,
		Claims: claims,
	}, nil
}

type JwtPayload struct {
	Sub    string
	Claims map[string]interface{}
}
