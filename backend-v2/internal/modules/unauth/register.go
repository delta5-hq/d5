package unauth

import (
	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(router fiber.Router, handler *Controller) {
	router.Get("/health", handler.HealthStatus)
	router.Get("/healthz", handler.HealthStatus)
	router.Get("/metrics", handler.ServeMetrics)
}
