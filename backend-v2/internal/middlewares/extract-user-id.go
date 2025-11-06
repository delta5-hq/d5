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
		c.Locals("userId", nil)
		return c.Next()
	}

	if auth != nil {
		if claims, ok := auth.(jwt.MapClaims); ok {
			if sub, ok := claims["sub"].(string); ok {
				c.Locals("userId", sub)
			}
		}
	}

	return c.Next()
}
