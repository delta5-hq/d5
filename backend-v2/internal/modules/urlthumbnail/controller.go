package urlthumbnail

import (
	"backend-v2/internal/common/response"
	"backend-v2/internal/services/thumbnail"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	thumbnailService thumbnail.Service
}

func NewController(thumbnailSvc thumbnail.Service) *Controller {
	return &Controller{
		thumbnailService: thumbnailSvc,
	}
}

/* GET /url/thumbnail - External service stub */
func (h *Controller) GetThumbnail(c *fiber.Ctx) error {
	url := c.Query("url")
	size := c.Query("size", "full")

	/* Validate required url parameter */
	if url == "" {
		return response.BadRequest(c, "Url is required query parameter")
	}

	/* Validate size parameter */
	validSizes := map[string]bool{
		"full":  true,
		"small": true,
		"tiny":  true,
	}

	if !validSizes[size] {
		return response.BadRequest(c, "Wrong size given ("+size+")")
	}

	/* Use thumbnail service (factory pattern) */
	resp, err := h.thumbnailService.Generate(thumbnail.GenerateRequest{
		URL:  url,
		Size: size,
	})

	if err != nil {
		return response.InternalError(c, err.Error())
	}

	/* Return PNG image from base64 thumbnail */
	c.Set("Content-Type", "image/png")
	return c.SendString(resp.Thumbnail)
}
