package macro

import (
	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func Register(router fiber.Router, db *qmgo.Database) {
	service := NewService(db)
	controller := NewController(service)

	macroGroup := router.Group("/macro")
	macroGroup.Use(Authorization)

	macroGroup.Post("/", controller.Create)
	macroGroup.Get("/", controller.List)
	macroGroup.Get("/:name/name", controller.GetByName)

	macroGroup.Use("/:macroId", Load(service))
	macroGroup.Get("/:macroId", controller.Get)
	macroGroup.Delete("/:macroId", controller.Delete)
}
