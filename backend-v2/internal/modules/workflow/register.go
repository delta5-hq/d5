package workflow

import (
	"backend-v2/internal/middlewares"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(app fiber.Router, handler *WorkflowController, db *qmgo.Database) {
	app.Post("/workflow", middlewares.RequireAuth, handler.CreateWorkflow)

	workflowRoutes := app.Group("/workflow")
	templateRoutes := workflowRoutes.Group("/from/template/:templateId")
	templateRoutes.Use(LoadTemplate(db), AuthTemplate)

	templateRoutes.Post("", handler.CreateWorkflowFromTemplate)

	workflowRoutes.Use("/:workflowId", Load(db), OptionalAuth, Authorization)

	workflowRoutes.Get("/:workflowId", handler.GetWorkflow)
	workflowRoutes.Put("/:workflowId", RejectMethod)
	workflowRoutes.Patch("/:workflowId", RejectMethod)
	workflowRoutes.Delete("/:workflowId", middlewares.RequireAuth, handler.DeleteWorkflow)

	workflowRoutes.Get("/:workflowId/writeable", middlewares.RequireAuth, handler.GetWriteable)
	workflowRoutes.Get("/:workflowId/nodeLimit", handler.GetNodeLimit)
	workflowRoutes.Post("/:workflowId/category", middlewares.RequireAuth, handler.AddCategory)

	workflowRoutes.Get("/:workflowId/export", handler.ExportJSON)
	workflowRoutes.Get("/:workflowId/export/json", handler.ExportJSON)
	workflowRoutes.Get("/:workflowId/export/zip", handler.ExportZIP)

	shareRoutes := workflowRoutes.Group("/:workflowId/share")
	shareRoutes.Get("", handler.GetShare)
	shareRoutes.Post("", middlewares.RequireAuth, handler.UpdateShare)
	shareRoutes.Get("/access", handler.GetShareAccess)
	shareRoutes.Post("/access", middlewares.RequireAuth, handler.SetShareAccess)
	shareRoutes.Get("/public", handler.GetSharePublic)
	shareRoutes.Post("/public", middlewares.RequireAuth, handler.SetSharePublic)
}

func OptionalAuth(c *fiber.Ctx) error {
	return c.Next()
}

func RejectMethod(c *fiber.Ctx) error {
	return c.Status(fiber.StatusMethodNotAllowed).JSON(fiber.Map{
		"error": "Method not allowed",
	})
}
