package unauth

import (
	"github.com/gofiber/fiber/v2"
)

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

/* Health check endpoint for monitoring */
func (h *Controller) HealthStatus(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{})
}

/* Prometheus metrics endpoint */
func (h *Controller) ServeMetrics(c *fiber.Ctx) error {
	metrics := "# HELP go_info Information about the Go environment.\n"
	metrics += "# TYPE go_info gauge\n"
	metrics += "go_info{version=\"go1.21\"} 1\n"

	c.Set("Content-Type", "text/plain; version=0.0.4")
	return c.SendString(metrics)
}
