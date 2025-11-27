package template

import (
	"backend-v2/internal/common/response"
	"backend-v2/internal/models"

	"github.com/gofiber/fiber/v2"
)

/* Load template from database */
func Load(service *Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		templateID := c.Params("templateId")

		template, err := service.GetByID(c.Context(), templateID)
		if err != nil {
			return response.NotFound(c, "Template not found.")
		}

		c.Locals("template", template)
		return c.Next()
	}
}

/* Authorization middleware for templates */
func Authorization(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	template := c.Locals("template").(*models.WorkflowTemplate)

	if userID == "" {
		return response.Unauthorized(c, "Authentication needed.")
	}

	/* Allow GET for public templates */
	if c.Method() == "GET" && template.IsPublic() {
		return c.Next()
	}

	/* Owner can do anything */
	if template.UserID == userID {
		return c.Next()
	}

	return response.Forbidden(c, "Access denied.")
}

/* Read-only authorization (allows public GET) */
func AuthorizationRead(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	template := c.Locals("template").(*models.WorkflowTemplate)

	if userID == "" {
		return response.Unauthorized(c, "Authentication needed.")
	}

	/* Owner or public template */
	if template.UserID == userID || template.IsPublic() {
		return c.Next()
	}

	return response.Forbidden(c, "Access denied.")
}
