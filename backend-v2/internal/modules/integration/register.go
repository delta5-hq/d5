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
	
	/* Service-specific controllers (non-LLM only) */
	midjourneyCtrl := NewMidjourneyController(services.Midjourney)
	zoomCtrl := NewZoomController(services.Zoom)
	freepikCtrl := NewFreepikController(services.Freepik)

	integrationGroup := router.Group("/integration")

	/* Protected group - JWT auth required for all endpoints */
	protectedGroup := integrationGroup.Group("", middlewares.RequireAuth)
	
	/* Core integration management (CRUD only) */
	protectedGroup.Get("/", baseCtrl.GetAll)
	protectedGroup.Delete("/", baseCtrl.Delete)
	protectedGroup.Get("/languages", baseCtrl.GetLanguages)
	protectedGroup.Post("/language", baseCtrl.SetLanguage)
	protectedGroup.Post("/model", baseCtrl.SetModel)
	
	/* LLM proxy endpoints for API key validation (NOT for production LLM execution) */
	/* Purpose: Validate user API keys when installing integrations */
	/* Production LLM execution handled by Node.js backend at /api/v1/integration/* */
	protectedGroup.Post("/chat/completions", services.LLMProxy.ChatCompletions)
	protectedGroup.Post("/embeddings", services.LLMProxy.Embeddings)
	protectedGroup.Post("/perplexity/chat/completions", services.LLMProxy.PerplexityChatCompletions)
	protectedGroup.Post("/claude/messages", services.LLMProxy.ClaudeMessages)
	protectedGroup.Post("/yandex/completion", services.LLMProxy.YandexCompletion)
	protectedGroup.Post("/custom_llm/chat/completions", services.LLMProxy.CustomLLMChatCompletions)
	protectedGroup.Post("/custom_llm/embeddings", services.LLMProxy.CustomLLMEmbeddings)
	
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
