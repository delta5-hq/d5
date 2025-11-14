package template

import (
	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(app fiber.Router, controller *Controller, service *Service) {
	templates := app.Group("/templates")

	templates.Get("", controller.List)
	templates.Post("", controller.Create)

	templates.Use("/:templateId", Load(service))
	templates.Use("/:templateId", Authorization)

	templates.Get("/:templateId", controller.Get)
	templates.Put("/:templateId", controller.Create)
	templates.Delete("/:templateId", controller.Delete)
	templates.Patch("/:templateId", controller.UpdateBackgroundImage)
}
