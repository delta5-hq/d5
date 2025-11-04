package workflow

import (
	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(app fiber.Router, handler *WorkflowController, db *qmgo.Database) {
	app.Get("/workflows", handler.GetWorkflows)
	app.Post("/workflows", handler.CreateWorkflow)

	workflowRoutes := app.Group("/workflows")
	templateRoutes := workflowRoutes.Group("/from/template/:templateId")
	templateRoutes.Use(LoadTemplate(db), AuthTemplate)

	templateRoutes.Post("", handler.CreateWorkflowFromTemplate)

	workflowRoutes.Use("/:workflowId", Load(db), Authorization)
	workflowRoutes.Get("/:workflowId", handler.GetWorkflow)
	workflowRoutes.Put("/:workflowId", handler.UpdateWorkflow)
	workflowRoutes.Delete("/:workflowId", handler.DeleteWorkflow)

	shareRoutes := workflowRoutes.Group("/:workflowId/share")
	shareRoutes.Get("", handler.GetShare)
	shareRoutes.Get("/access", handler.GetShareAccess)
	shareRoutes.Post("/access", handler.SetShareAccess)
	shareRoutes.Get("/public", handler.GetSharePublic)
	shareRoutes.Post("/public", handler.SetSharePublic)
}
