package middlewares

import (
	"github.com/gofiber/fiber/v2"
)

/* OptionalAuth extracts JWT if present but does not require it */
func OptionalAuth(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Next()
	}

	/* Try to extract JWT but don't fail if it's invalid */
	if err := JWTMiddleware(c); err != nil {
		return c.Next()
	}

	return ExtractUserID(c)
}
