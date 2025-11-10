package urlthumbnail

import (
	"backend-v2/internal/middlewares"

	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(api fiber.Router) {
	controller := NewController()

	url := api.Group("/url")
	url.Use(middlewares.ExtractUserID)

	url.Get("/thumbnail", controller.GetThumbnail)
}
