package integration

import (
	"backend-v2/internal/common/constants"

	"github.com/gofiber/fiber/v2"
)

func getUserID(c *fiber.Ctx) (string, error) {
	userID, ok := c.Locals(constants.ContextUserIDKey).(string)
	if !ok || userID == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}
	return userID, nil
}

func parseBody(c *fiber.Ctx, v interface{}) error {
	if err := c.BodyParser(v); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	return nil
}
