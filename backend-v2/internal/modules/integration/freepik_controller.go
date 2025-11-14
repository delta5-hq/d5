package integration

import (
	"backend-v2/internal/services/freepik"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

/* FreepikController handles Freepik-specific endpoints */
type FreepikController struct {
	service freepik.Service
}

func NewFreepikController(service freepik.Service) *FreepikController {
	return &FreepikController{
		service: service,
	}
}

func (ctrl *FreepikController) Icons(c *fiber.Ctx) error {
	query := c.Query("term", "")
	limitStr := c.Query("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	/* Use injected service (noop or prod) */
	result, err := ctrl.service.SearchIcons(query, limit)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(result)
}

/* DownloadIcon handles Freepik icon download */
func (ctrl *FreepikController) DownloadIcon(c *fiber.Ctx) error {
	var req struct {
		ID      string `json:"id"`
		PngSize string `json:"png_size"`
	}

	if err := parseBody(c, &req); err != nil {
		return err
	}

	/* Use injected service (noop or prod) */
	result, err := ctrl.service.DownloadIcon(req.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(result)
}
