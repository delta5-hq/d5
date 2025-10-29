package middlewares

import (
	"backend-v2/internal/config"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func JWTMiddleware(c *fiber.Ctx) error {
	var tokenStr string

	if cookie := c.Cookies("auth"); cookie != "" {
		tokenStr = cookie
	} else if authHeader := c.Get("Authorization"); authHeader != "" {
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
			tokenStr = parts[1]
		}
	}

	if tokenStr == "" {
		c.Locals("jwtOriginalError", "jwt must be provided")
		return c.Next()
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		return []byte(config.JwtSecret), nil
	})

	if err != nil || !token.Valid {
		c.Locals("jwtOriginalError", err.Error())
		return c.Next()
	}

	c.Locals("auth", token.Claims)

	return c.Next()
}
