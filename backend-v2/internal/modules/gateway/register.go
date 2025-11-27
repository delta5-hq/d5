package gateway

import (
	"backend-v2/internal/middlewares"

	"github.com/gofiber/fiber/v2"
)

func Register(router fiber.Router) {
	config := NewConfig()
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	protectedGroup := router.Group("/")
	protectedGroup.Use(middlewares.JWTMiddleware)
	protectedGroup.Use(middlewares.ExtractUserID)

	registry.RegisterNodeJSRoutes(protectedGroup)
}
