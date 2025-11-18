package macro

import (
	"backend-v2/internal/common/response"

	"github.com/gofiber/fiber/v2"
)

func Authorization(c *fiber.Ctx) error {
	userID := c.Locals("userId")

	if userID == nil {
		return response.Unauthorized(c, "Authentication needed.")
	}

	return c.Next()
}

func Load(service *Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		macroID := c.Params("macroId")
		userID, _ := c.Locals("userId").(string)

		macro, err := service.FindByID(c.Context(), macroID)
		if err != nil {
			return response.NotFound(c, "Macro not found.")
		}

		if userID != macro.UserID {
			return response.Forbidden(c, "Permissions denied.")
		}

		c.Locals("macro", macro)

		return c.Next()
	}
}
