package sync

import (
	"backend-v2/internal/middlewares"
	"backend-v2/internal/modules/user"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(api fiber.Router, db *qmgo.Database) {
	userService := user.NewService(db)
	controller := NewController(userService)

	sync := api.Group("/sync")
	sync.Use(middlewares.ExtractUserID)
	sync.Use(Authorization)

	sync.Post("/users", controller.AllUser)
	sync.Post("/userMetaData", controller.AllUserMetaData)
}
