package macro

import (
	"github.com/gofiber/fiber/v2"
)

func Authorization(c *fiber.Ctx) error {
	userID := c.Locals("userId")

	if userID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Authentication needed.",
		})
	}

	return c.Next()
}

func Load(service *Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		macroID := c.Params("macroId")
		userID, _ := c.Locals("userId").(string)

		macro, err := service.FindByID(c.Context(), macroID)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"message": "Macro not found.",
			})
		}

		if userID != macro.UserID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"message": "Permissions denied.",
			})
		}

		c.Locals("macro", macro)

		return c.Next()
	}
}
