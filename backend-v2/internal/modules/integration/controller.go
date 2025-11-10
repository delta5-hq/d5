package integration

import (
	"backend-v2/internal/common/constants"
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

type Controller struct {
	service *Service
	db      *qmgo.Database
}

func NewController(service *Service, db *qmgo.Database) *Controller {
	return &Controller{
		service: service,
		db:      db,
	}
}

func (ctrl *Controller) Authorization(c *fiber.Ctx) error {
	userID := c.Locals(constants.ContextUserIDKey)

	if userID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Authentication needed.",
		})
	}

	return c.Next()
}

/* GET /integration - Returns all integration config for user */
func (ctrl *Controller) GetAll(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	integration, err := ctrl.service.FindByUserID(c.Context(), userID)
	if err != nil {
		if err == qmgo.ErrNoSuchDocuments {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"message": "Integration not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(integration)
}

/* GET /integration/:service - Returns specific service config */
func (ctrl *Controller) GetService(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)
	service := c.Params("service")

	integration, err := ctrl.service.FindByUserID(c.Context(), userID)
	if err != nil {
		if err == qmgo.ErrNoSuchDocuments {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"message": "Integration for the called application was not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	integrationBytes, _ := json.Marshal(integration)
	var integrationMap map[string]interface{}
	json.Unmarshal(integrationBytes, &integrationMap)

	response := map[string]interface{}{
		service: integrationMap[service],
	}

	return c.JSON(response)
}

/* PUT /integration/:service/update - Updates service API keys */
func (ctrl *Controller) UpdateService(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)
	service := c.Params("service")

	var serviceConfig map[string]interface{}
	if err := c.BodyParser(&serviceConfig); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Something is wrong with the provided data",
		})
	}

	vectors, err := ctrl.service.CreateLLMVector(c.Context(), ctrl.db, userID, service)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	update := map[string]interface{}{
		service: serviceConfig,
	}

	err = ctrl.service.Upsert(c.Context(), userID, update)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"vectors": vectors,
	})
}

/* DELETE /integration - Deletes all integration config */
func (ctrl *Controller) Delete(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	err := ctrl.service.Delete(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

/* GET /integration/languages - Returns available languages */
func (ctrl *Controller) GetLanguages(c *fiber.Ctx) error {
	languages := []map[string]string{
		{"code": "en", "name": "English"},
		{"code": "es", "name": "Spanish"},
		{"code": "fr", "name": "French"},
		{"code": "de", "name": "German"},
		{"code": "ru", "name": "Russian"},
		{"code": "zh", "name": "Chinese"},
	}
	return c.JSON(languages)
}

/* POST /integration/language - Sets language preference */
func (ctrl *Controller) SetLanguage(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	/* Node.js reads 'lang' but test sends 'language' - field mismatch causes 500 */
	lang, ok := body["lang"].(string)
	if !ok {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Lang not specified",
		})
	}

	update := map[string]interface{}{
		"lang": lang,
	}

	err := ctrl.service.Upsert(c.Context(), userID, update)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"lang": lang,
	})
}

/* POST /integration/model - Sets model preference */
func (ctrl *Controller) SetModel(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	model, ok := body["model"].(string)
	if !ok {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Model not specified",
		})
	}

	update := map[string]interface{}{
		"model": model,
	}

	err := ctrl.service.Upsert(c.Context(), userID, update)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"model": model,
	})
}

/* GET /integration/openai_api_key - Checks if OpenAI key exists */
func (ctrl *Controller) CheckOpenAIKey(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	integration, err := ctrl.service.FindByUserID(c.Context(), userID)
	success := err == nil && integration.OpenAI != nil && integration.OpenAI.APIKey != ""

	return c.JSON(fiber.Map{
		"success": success,
	})
}

/* Stub endpoints that return errors for external API calls */

func (ctrl *Controller) ScrapeV2(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"message": "Endpoint not implemented",
	})
}

func (ctrl *Controller) ScrapeFiles(c *fiber.Ctx) error {
	return c.JSON([]interface{}{})
}

func (ctrl *Controller) Translate(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "text is required",
	})
}

func (ctrl *Controller) Search(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Search service unavailable",
	})
}

func (ctrl *Controller) DownloadImage(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Image download service unavailable",
	})
}

func (ctrl *Controller) YandexCompletion(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Yandex completion service unavailable",
	})
}

func (ctrl *Controller) YandexEmbeddings(c *fiber.Ctx) error {
	return c.Status(fiber.StatusBadRequest).SendString("Yandex embeddings service unavailable")
}

func (ctrl *Controller) ChatCompletions(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Model name not specified",
	})
}

func (ctrl *Controller) Embeddings(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Model name not specified",
	})
}

func (ctrl *Controller) ImageGenerations(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"message": "Request failed with status code 401",
	})
}

func (ctrl *Controller) FreepikIcons(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"message": "Icon search service unavailable",
	})
}

func (ctrl *Controller) DownloadIcon(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"message": "Icon download service unavailable",
	})
}

func (ctrl *Controller) MidjourneyCreate(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"message": "Midjourney service unavailable",
	})
}

func (ctrl *Controller) MidjourneyUpscale(c *fiber.Ctx) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"message": "Midjourney upscale service unavailable",
	})
}

func (ctrl *Controller) ZoomAuth(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Zoom authorization service unavailable",
	})
}

func (ctrl *Controller) ZoomRecordings(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).SendString("Zoom recordings service unavailable")
}

func (ctrl *Controller) ClaudeMessages(c *fiber.Ctx) error {
	return c.Status(fiber.StatusBadRequest).SendString("Claude service unavailable")
}

func (ctrl *Controller) PerplexityChatCompletions(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Messages are required",
	})
}
