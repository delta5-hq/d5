package unauth

import (
	"backend-v2/internal/config"

	"github.com/gofiber/fiber/v2"
)

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

func (h *Controller) HealthStatus(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{})
}

func (h *Controller) ServeMetrics(c *fiber.Ctx) error {
	metrics := "# HELP go_info Information about the Go environment.\n"
	metrics += "# TYPE go_info gauge\n"
	metrics += "go_info{version=\"go1.21\"} 1\n"

	c.Set("Content-Type", "text/plain; version=0.0.4")
	return c.SendString(metrics)
}

func (h *Controller) VersionStatus(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"revision": config.BuildRevision,
	})
}
