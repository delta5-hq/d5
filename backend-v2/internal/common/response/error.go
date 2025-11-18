package response

import "github.com/gofiber/fiber/v2"

type ErrorResponse struct {
	Message string `json:"message"`
}

func sendError(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(ErrorResponse{
		Message: message,
	})
}

func BadRequest(c *fiber.Ctx, message string) error {
	return sendError(c, fiber.StatusBadRequest, message)
}

func Unauthorized(c *fiber.Ctx, message string) error {
	return sendError(c, fiber.StatusUnauthorized, message)
}

func Forbidden(c *fiber.Ctx, message string) error {
	return sendError(c, fiber.StatusForbidden, message)
}

func NotFound(c *fiber.Ctx, message string) error {
	return sendError(c, fiber.StatusNotFound, message)
}

func InternalError(c *fiber.Ctx, message string) error {
	return sendError(c, fiber.StatusInternalServerError, message)
}
