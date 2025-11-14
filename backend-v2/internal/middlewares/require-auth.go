package middlewares

import (
	"backend-v2/internal/common/constants"

	"github.com/gofiber/fiber/v2"
)

func RequireAuth(c *fiber.Ctx) error {
	userID := c.Locals(constants.ContextUserIDKey)
	
	if userID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Authentication required",
		})
	}
	
	return c.Next()
}
