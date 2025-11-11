package router

import (
	"os"

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
	"backend-v2/internal/services/claude"
	"backend-v2/internal/services/email"
	"backend-v2/internal/services/openai"
	"backend-v2/internal/services/perplexity"
	"backend-v2/internal/services/yandex"
	"backend-v2/internal/services/midjourney"
	"backend-v2/internal/services/zoom"
	"backend-v2/internal/services/freepik"
	"backend-v2/internal/services/scraper"
	"backend-v2/internal/services/thumbnail"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(app *fiber.App, db *qmgo.Database) {
	/* Create email service - use noop for E2E testing, SMTP for production */
	var emailService email.Service
	if os.Getenv("E2E_MODE") == "true" {
		emailService = email.NewNoopService()
	} else {
		emailService = email.NewSMTPService()
	}

	/* Create OpenAI service - use noop for E2E testing, production for real API */
	var openaiService openai.Service
	if os.Getenv("E2E_MODE") == "true" {
		openaiService = openai.NewNoopService()
	} else {
		openaiService = openai.NewProdService()
	}

	/* Create Claude service - use noop for E2E testing, production for real API */
	var claudeService claude.Service
	if os.Getenv("E2E_MODE") == "true" {
		claudeService = claude.NewNoopService()
	} else {
		claudeService = claude.NewProdService()
	}

	/* Create Perplexity service - use noop for E2E testing, production for real API */
	var perplexityService perplexity.Service
	if os.Getenv("E2E_MODE") == "true" {
		perplexityService = perplexity.NewNoopService()
	} else {
		perplexityService = perplexity.NewProdService()
	}

	/* Create Yandex service - use noop for E2E testing, production for real API */
	var yandexService yandex.Service
	if os.Getenv("E2E_MODE") == "true" {
		yandexService = yandex.NewNoopService()
	} else {
		yandexService = yandex.NewProdService()
	}

	/* Create Midjourney service - use noop for E2E testing, production for real API */
	var midjourneyService midjourney.Service
	if os.Getenv("E2E_MODE") == "true" {
		midjourneyService = midjourney.NewNoopService()
	} else {
		midjourneyService = midjourney.NewProdService()
	}

	/* Create Zoom service - use noop for E2E testing, production for real API */
	var zoomService zoom.Service
	if os.Getenv("E2E_MODE") == "true" {
		zoomService = zoom.NewNoopService()
	} else {
		zoomService = zoom.NewProdService()
	}

	/* Create Freepik service - use noop for E2E testing, production for real API */
	var freepikService freepik.Service
	if os.Getenv("E2E_MODE") == "true" {
		freepikService = freepik.NewNoopService()
	} else {
		freepikService = freepik.NewProdService()
	}

	/* Create Scraper service - use noop for E2E testing, production for real API */
	var scraperService scraper.Service
	if os.Getenv("E2E_MODE") == "true" {
		scraperService = scraper.NewNoopService()
	} else {
		scraperService = scraper.NewProdService()
	}

	/* Create Thumbnail service - use noop for E2E testing, production for real API */
	var thumbnailService thumbnail.Service
	if os.Getenv("E2E_MODE") == "true" {
		thumbnailService = thumbnail.NewNoopService()
	} else {
		thumbnailService = thumbnail.NewProdService()
	}

	unauthHandler := unauth.NewController()
	unauth.RegisterRoutes(app, unauthHandler)

	// Register auth routes before JWT middleware (public routes)
	apiPublic := app.Group("/api/v1")
	auth.RegisterRoutes(apiPublic, db, emailService)

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
	integration.Register(v1, db, openaiService, claudeService, perplexityService, yandexService, midjourneyService, zoomService, freepikService, scraperService)
	user.RegisterRoutes(v1, db)
	sync.RegisterRoutes(v1, db)
	llmvector.RegisterRoutes(v1, db)
	clienterror.RegisterRoutes(v1, db)
	statistics.Register(v1, db)
	urlthumbnail.RegisterRoutes(v1, thumbnailService)
}
