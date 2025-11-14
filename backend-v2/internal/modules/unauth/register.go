package unauth

import (
	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(app *fiber.App, handler *Controller) {
	app.Get("/healthz", handler.HealthStatus)
	app.Get("/api/v1/healthz", handler.HealthStatus)
	app.Get("/metrics", handler.ServeMetrics)
}
