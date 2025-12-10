package integration

import (
	"github.com/gofiber/fiber/v2"
)

func parseBody(c *fiber.Ctx, v interface{}) error {
	if err := c.BodyParser(v); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	return nil
}
