package middlewares

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/logger"
	"backend-v2/internal/common/response"

	"github.com/gofiber/fiber/v2"
)

var reqAuthLog = logger.New("REQ-AUTH")

func RequireAuth(c *fiber.Ctx) error {
	userID := c.Locals(constants.ContextUserIDKey)

	if userID == nil {
		reqAuthLog.Warn("RequireAuth: No userID found, path=%s, method=%s", c.Path(), c.Method())
		return response.Unauthorized(c, "Authentication required")
	}

	return c.Next()
}
