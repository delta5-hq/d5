package integration

import (
	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func Register(router fiber.Router, db *qmgo.Database) {
	service := NewService(db)
	controller := NewController(service, db)

	integrationGroup := router.Group("/integration")

	/* Public endpoints - no auth */
	integrationGroup.Post("/scrape_v2", controller.ScrapeV2)
	integrationGroup.Post("/scrape_files", controller.ScrapeFiles)
	integrationGroup.Post("/translate", controller.Translate)

	/* Protected endpoints - require auth */
	integrationGroup.Use(controller.Authorization)
	
	integrationGroup.Get("/search", controller.Search)
	integrationGroup.Get("/", controller.GetAll)
	integrationGroup.Delete("/", controller.Delete)
	integrationGroup.Get("/languages", controller.GetLanguages)
	integrationGroup.Post("/language", controller.SetLanguage)
	integrationGroup.Post("/model", controller.SetModel)
	integrationGroup.Get("/openai_api_key", controller.CheckOpenAIKey)
	integrationGroup.Get("/:service", controller.GetService)
	integrationGroup.Put("/:service/update", controller.UpdateService)
	integrationGroup.Post("/downloadImage", controller.DownloadImage)
	integrationGroup.Post("/yandex/completion", controller.YandexCompletion)
	integrationGroup.Post("/yandex/embeddings", controller.YandexEmbeddings)
	integrationGroup.Post("/chat/completions", controller.ChatCompletions)
	integrationGroup.Post("/embeddings", controller.Embeddings)
	integrationGroup.Post("/images/generations", controller.ImageGenerations)
	integrationGroup.Get("/icons/freepik", controller.FreepikIcons)
	integrationGroup.Post("/icons/download", controller.DownloadIcon)
	integrationGroup.Post("/midjourney/create", controller.MidjourneyCreate)
	integrationGroup.Post("/midjourney/upscale", controller.MidjourneyUpscale)
	integrationGroup.Post("/zoom/auth", controller.ZoomAuth)
	integrationGroup.Get("/zoom/meetings/:id/recordings", controller.ZoomRecordings)
	integrationGroup.Post("/claude/messages", controller.ClaudeMessages)
	integrationGroup.Post("/perplexity/chat/completions", controller.PerplexityChatCompletions)
}
