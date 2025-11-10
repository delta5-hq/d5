package router

import (
	"backend-v2/internal/middlewares"
	"backend-v2/internal/modules/auth"
	"backend-v2/internal/modules/clienterror"
	"backend-v2/internal/modules/integration"
	"backend-v2/internal/modules/llmvector"
	"backend-v2/internal/modules/macro"
	"backend-v2/internal/modules/statistics"
	"backend-v2/internal/modules/sync"
	"backend-v2/internal/modules/template"
	"backend-v2/internal/modules/unauth"
	"backend-v2/internal/modules/urlthumbnail"
	"backend-v2/internal/modules/user"
	"backend-v2/internal/modules/workflow"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(app *fiber.App, db *qmgo.Database) {
	unauthHandler := unauth.NewController()
	unauth.RegisterRoutes(app, unauthHandler)

	// Register auth routes before JWT middleware (public routes)
	apiPublic := app.Group("/api/v1")
	auth.RegisterRoutes(apiPublic, db)

	api := app.Group("/api")
	api.Use(middlewares.JWTMiddleware)
	api.Use(middlewares.ExtractUserID)

	v1 := api.Group("/v1")

	workflowService := workflow.NewService(db)
	workflowHandler := workflow.NewHandler(workflowService)
	v1.Get("/workflow", workflowHandler.GetWorkflows)

	templateService := template.NewService(db)
	templateController := template.NewController(templateService)
	template.RegisterRoutes(v1, templateController, templateService)

	workflow.RegisterRoutes(v1, workflowHandler, db)
	macro.Register(v1, db)
	integration.Register(v1, db)
	user.RegisterRoutes(v1, db)
	sync.RegisterRoutes(v1, db)
	llmvector.RegisterRoutes(v1, db)
	clienterror.RegisterRoutes(v1, db)
	statistics.Register(v1, db)
	urlthumbnail.RegisterRoutes(v1)
}
