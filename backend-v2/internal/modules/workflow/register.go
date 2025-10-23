package workflow

import "github.com/gofiber/fiber/v2"

func RegisterRoutes(app fiber.Router, handler *WorkflowController) {
	app.Get("/workflows/:workflowId", handler.GetWorkflow)
}
