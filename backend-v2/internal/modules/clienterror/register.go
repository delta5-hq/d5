package clienterror

import (
	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"

	"backend-v2/internal/middlewares"
)

func RegisterRoutes(router fiber.Router, db *qmgo.Database) {
	collection := db.Collection("clienterrors")
	service := NewService(collection)
	controller := NewController(service)

	router.Post("/errors", middlewares.ExtractUserID, controller.Create)
	router.Get("/errors", middlewares.ExtractUserID, controller.List)
}
