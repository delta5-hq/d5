package integration

import (
	"backend-v2/internal/middlewares"
	"backend-v2/internal/services/container"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func Register(router fiber.Router, db *qmgo.Database, services *container.ServiceContainer) {
	service := NewService(db)
	
	/* Core integration CRUD controller */
	baseCtrl := NewController(service, db)
	
	/* Service-specific controllers */
	openaiCtrl := NewOpenAIController(services.OpenAI)
	claudeCtrl := NewClaudeController(services.Claude, db)
	perplexityCtrl := NewPerplexityController(services.Perplexity, db)
	yandexCtrl := NewYandexController(services.Yandex, db)
	midjourneyCtrl := NewMidjourneyController(services.Midjourney)
	zoomCtrl := NewZoomController(services.Zoom)
	freepikCtrl := NewFreepikController(services.Freepik)

	integrationGroup := router.Group("/integration")

	/* Protected endpoints - require auth */
	integrationGroup.Use(middlewares.RequireAuth)
	
	/* Core integration management */
	integrationGroup.Get("/", baseCtrl.GetAll)
	integrationGroup.Delete("/", baseCtrl.Delete)
	integrationGroup.Get("/languages", baseCtrl.GetLanguages)
	integrationGroup.Post("/language", baseCtrl.SetLanguage)
	integrationGroup.Post("/model", baseCtrl.SetModel)
	
	/* OpenAI endpoints - BEFORE /:service to avoid param capture */
	integrationGroup.Get("/openai_api_key", openaiCtrl.CheckApiKey)
	integrationGroup.Post("/chat/completions", openaiCtrl.ChatCompletions)
	integrationGroup.Post("/embeddings", openaiCtrl.Embeddings)
	integrationGroup.Post("/images/generations", openaiCtrl.ImageGenerations)
	
	/* Claude endpoints */
	integrationGroup.Post("/claude/messages", claudeCtrl.Messages)
	
	/* Perplexity endpoints */
	integrationGroup.Post("/perplexity/chat/completions", perplexityCtrl.ChatCompletions)
	
	/* Yandex endpoints */
	integrationGroup.Post("/yandex/completion", yandexCtrl.Completion)
	integrationGroup.Post("/yandex/embeddings", yandexCtrl.Embeddings)
	
	/* Midjourney endpoints */
	integrationGroup.Post("/midjourney/create", midjourneyCtrl.Create)
	integrationGroup.Post("/midjourney/upscale", midjourneyCtrl.Upscale)
	
	/* Zoom endpoints */
	integrationGroup.Post("/zoom/auth", zoomCtrl.Auth)
	integrationGroup.Get("/zoom/meetings/:id/recordings", zoomCtrl.Recordings)
	
	/* Freepik endpoints */
	integrationGroup.Get("/icons/freepik", freepikCtrl.Icons)
	integrationGroup.Post("/icons/download", freepikCtrl.DownloadIcon)
	
	/* Parameterized routes LAST - catches remaining requests */
	integrationGroup.Get("/:service", baseCtrl.GetService)
	integrationGroup.Put("/:service/update", baseCtrl.UpdateService)
}
