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

	/* Protected group - JWT auth required for all endpoints */
	protectedGroup := integrationGroup.Group("", middlewares.RequireAuth)
	
	/* Core integration management */
	protectedGroup.Get("/", baseCtrl.GetAll)
	protectedGroup.Delete("/", baseCtrl.Delete)
	protectedGroup.Get("/languages", baseCtrl.GetLanguages)
	protectedGroup.Post("/language", baseCtrl.SetLanguage)
	protectedGroup.Post("/model", baseCtrl.SetModel)
	
	/* OpenAI endpoints */
	protectedGroup.Get("/openai_api_key", openaiCtrl.CheckApiKey)
	protectedGroup.Post("/chat/completions", openaiCtrl.ChatCompletions)
	protectedGroup.Post("/embeddings", openaiCtrl.Embeddings)
	protectedGroup.Post("/images/generations", openaiCtrl.ImageGenerations)
	
	/* Claude endpoints */
	protectedGroup.Post("/claude/messages", claudeCtrl.Messages)
	
	/* Perplexity endpoints */
	protectedGroup.Post("/perplexity/chat/completions", perplexityCtrl.ChatCompletions)
	
	/* Yandex endpoints */
	protectedGroup.Post("/yandex/completion", yandexCtrl.Completion)
	protectedGroup.Post("/yandex/embeddings", yandexCtrl.Embeddings)
	
	/* Midjourney endpoints */
	protectedGroup.Post("/midjourney/create", midjourneyCtrl.Create)
	protectedGroup.Post("/midjourney/upscale", midjourneyCtrl.Upscale)
	
	/* Zoom endpoints */
	protectedGroup.Post("/zoom/auth", zoomCtrl.Auth)
	protectedGroup.Get("/zoom/meetings/:id/recordings", zoomCtrl.Recordings)
	
	/* Freepik endpoints */
	protectedGroup.Get("/icons/freepik", freepikCtrl.Icons)
	protectedGroup.Post("/icons/download", freepikCtrl.DownloadIcon)
	
	/* Parameterized routes LAST - catches remaining requests */
	protectedGroup.Get("/:service", baseCtrl.GetService)
	protectedGroup.Put("/:service/update", baseCtrl.UpdateService)
	protectedGroup.Delete("/:service/delete", baseCtrl.DeleteService)
}
