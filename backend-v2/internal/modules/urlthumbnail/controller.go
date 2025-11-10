package urlthumbnail

import (
	"github.com/gofiber/fiber/v2"
)

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

/* GET /url/thumbnail - External service stub */
func (h *Controller) GetThumbnail(c *fiber.Ctx) error {
	url := c.Query("url")
	size := c.Query("size", "full")

	/* Validate required url parameter */
	if url == "" {
		return c.Status(fiber.StatusBadRequest).SendString("Url is required query parameter")
	}

	/* Validate size parameter */
	validSizes := map[string]bool{
		"full":  true,
		"small": true,
		"tiny":  true,
	}

	if !validSizes[size] {
		return c.Status(fiber.StatusBadRequest).SendString("Wrong size given (" + size + ")")
	}

	/* External service not available - return 500 */
	return c.Status(fiber.StatusInternalServerError).SendString("Service unavailable")
}
