package middlewares

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/response"

	"github.com/gofiber/fiber/v2"
)

func RequireAuth(c *fiber.Ctx) error {
	userID := c.Locals(constants.ContextUserIDKey)
	
	if userID == nil {
		return response.Unauthorized(c, "Authentication required")
	}
	
	return c.Next()
}
