package router

import (
	"backend-v2/internal/config"
	"backend-v2/internal/database"
	"backend-v2/internal/middlewares"
	"backend-v2/internal/modules/auth"
	"backend-v2/internal/modules/clienterror"
	"backend-v2/internal/modules/gateway"
	"backend-v2/internal/modules/integration"
	"backend-v2/internal/modules/llmvector"
	"backend-v2/internal/modules/macro"
	"backend-v2/internal/modules/progress"
	"backend-v2/internal/modules/statistics"
	"backend-v2/internal/modules/sync"
	"backend-v2/internal/modules/template"
	"backend-v2/internal/modules/unauth"
	"backend-v2/internal/modules/urlthumbnail"
	"backend-v2/internal/modules/user"
	"backend-v2/internal/modules/workflow"
	"backend-v2/internal/services/container"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(app *fiber.App, db *qmgo.Database, services *container.ServiceContainer) {
	apiRoot := app.Group(config.ApiRoot)

	gateway.Register(apiRoot)

	unauthHandler := unauth.NewController()
	unauth.RegisterRoutes(apiRoot, unauthHandler)

	auth.RegisterRoutes(apiRoot, db, services.Email)

	api := apiRoot.Group("/")
	api.Use(middlewares.JWTMiddleware)
	api.Use(middlewares.ExtractUserID)

	workflowService := workflow.NewService(db)
	workflowHandler := workflow.NewHandler(workflowService, db, database.MongoClient)
	api.Get("/workflow", workflowHandler.GetWorkflows)

	templateService := template.NewService(db)
	templateController := template.NewController(templateService)
	template.RegisterRoutes(api, templateController, templateService)

	workflow.RegisterRoutes(api, workflowHandler, db)
	macro.Register(api, db)
	integration.Register(api, db, services)
	user.RegisterRoutes(api, db)
	sync.RegisterRoutes(api, db)
	llmvector.RegisterRoutes(api, db)
	clienterror.RegisterRoutes(api, db)
	statistics.Register(api, db)
	urlthumbnail.RegisterRoutes(api, services.Thumbnail)
	progress.RegisterRoutes(api)
}
