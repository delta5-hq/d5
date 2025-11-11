package urlthumbnail

import (
	"backend-v2/internal/middlewares"
	"backend-v2/internal/services/thumbnail"

	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(api fiber.Router, thumbnailService thumbnail.Service) {
	controller := NewController(thumbnailService)

	url := api.Group("/url")
	url.Use(middlewares.ExtractUserID)

	url.Get("/thumbnail", controller.GetThumbnail)
}
