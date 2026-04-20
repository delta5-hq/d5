package progress

import "github.com/gofiber/fiber/v2"

func RegisterRoutes(api fiber.Router) {
	controller := NewController()
	group := api.Group("/progress")
	group.Get("/stream", controller.Stream)
}
