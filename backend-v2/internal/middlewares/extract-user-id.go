package middlewares

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func ExtractUserID(c *fiber.Ctx) error {
	jwtErr := c.Locals("jwtOriginalError")
	auth := c.Locals("auth")

	if jwtErr != nil {
		log.Println("jwt not valid:", jwtErr)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": jwtErr,
		})
	}

	if auth != nil {
		if claims, ok := auth.(jwt.MapClaims); ok {
			if sub, ok := claims["sub"].(string); ok {
				c.Locals("userId", sub)
			}
		}
	} else {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "jwt must be provided",
		})
	}

	return c.Next()
}
