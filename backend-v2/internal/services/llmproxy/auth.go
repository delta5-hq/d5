package llmproxy

import "github.com/gofiber/fiber/v2"

const (
	bearerPrefix      = "Bearer "
	emptyAPIKey       = "EMPTY"
	headerAuth        = "Authorization"
	headerAPIKey      = "x-api-key"
	headerContentType = "Content-Type"
	contentTypeJSON   = "application/json"
)

type AuthExtractor func(*fiber.Ctx) string

func BearerTokenExtractor(c *fiber.Ctx) string {
	auth := c.Get(headerAuth)
	if len(auth) > len(bearerPrefix) && auth[:len(bearerPrefix)] == bearerPrefix {
		return auth[len(bearerPrefix):]
	}
	return ""
}

func HeaderAPIKeyExtractor(c *fiber.Ctx) string {
	return c.Get(headerAPIKey)
}

func IsEmptyAPIKey(key string) bool {
	return key == "" || key == emptyAPIKey
}
