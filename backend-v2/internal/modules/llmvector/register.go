package llmvector

import (
	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"

	"backend-v2/internal/middlewares"
)

func RegisterRoutes(router fiber.Router, db *qmgo.Database) {
	collection := db.Collection("llmvectors")
	service := NewService(collection)
	controller := NewController(service)

	router.Post("/vector", middlewares.ExtractUserID, controller.Save)
	router.Get("/vector", middlewares.ExtractUserID, controller.Get)
	router.Get("/vector/all", middlewares.ExtractUserID, controller.GetAll)
	router.Delete("/vector", middlewares.ExtractUserID, controller.Delete)
	router.Get("/vector/overview", middlewares.ExtractUserID, controller.Overview)
}
