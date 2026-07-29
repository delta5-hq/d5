package gateway

import (
	"backend-v2/internal/middlewares"

	"github.com/gofiber/fiber/v2"
)

func Register(router fiber.Router) error {
	config := NewConfig()
	proxy := NewProxy(config)
	registry, err := NewRouteRegistry(proxy)
	if err != nil {
		return err
	}

	protectedGroup := router.Group("/")
	protectedGroup.Use(middlewares.JWTMiddleware)
	protectedGroup.Use(middlewares.ExtractUserID)

	registry.RegisterNodeJSRoutes(protectedGroup)
	return nil
}
