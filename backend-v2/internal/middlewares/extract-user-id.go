package middlewares

import (
	"github.com/gofiber/fiber/v2"
)

var userIDExtractorInstance = CreateUserIDExtractor()

func ExtractUserID(ctx *fiber.Ctx) error {
	return userIDExtractorInstance.Handle(ctx)
}
