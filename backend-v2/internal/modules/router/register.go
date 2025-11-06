package router

import (
	"backend-v2/internal/middlewares"
	"backend-v2/internal/modules/workflow"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(app *fiber.App, db *qmgo.Database) {
	api := app.Group("/api")

	v1 := api.Group("/v1")

	workflowService := workflow.NewService(db)
	workflowHandler := workflow.NewHandler(workflowService)
	v1.Get("/workflow", workflowHandler.GetWorkflows)

	api.Use(middlewares.JWTMiddleware)
	api.Use(middlewares.ExtractUserID)

	workflow.RegisterRoutes(v1, workflowHandler, db)
}
