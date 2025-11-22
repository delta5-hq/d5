package middlewares

import (
	"backend-v2/internal/common/response"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func ExtractUserID(c *fiber.Ctx) error {
	jwtErr := c.Locals("jwtOriginalError")
	auth := c.Locals("auth")

	if jwtErr != nil {
		errMsg, _ := jwtErr.(string)
		if errMsg != "" && errMsg != "jwt must be provided" {
			return response.Unauthorized(c, errMsg)
		}
		c.Locals("userId", nil)
		return c.Next()
	}

	if auth != nil {
		if claims, ok := auth.(jwt.MapClaims); ok {
			if sub, ok := claims["sub"].(string); ok {
				c.Locals("userId", sub)
			} else if userId, ok := claims["userId"].(string); ok {
				c.Locals("userId", userId)
			}
			if roles, ok := claims["roles"].([]interface{}); ok {
				roleStrs := make([]string, len(roles))
				for i, r := range roles {
					if roleStr, ok := r.(string); ok {
						roleStrs[i] = roleStr
					}
				}
				c.Locals("roles", roleStrs)
			}
		}
	}

	return c.Next()
}
